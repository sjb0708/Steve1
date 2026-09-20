// Market Analysis server side: saved inputs, the daily scan of every active
// market (for-sale homes, Airbnb rates, competitor calendars, county
// records), deal alerts, and the data the page needs.

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"
import { getSetting, setSetting } from "@/lib/app-settings"
import { fetchForSaleListings } from "@/lib/redfin"
import { lookupCountyRecord } from "@/lib/county-records"
import {
  airbnbGet, parseSearch, searchUrl, sleep, todayInOcala, addDays, dayOfWeek,
  fetchCalendar, FALLBACK_API_KEY, milesBetween,
} from "@/lib/market-data"
import { buildPriceEvaluation } from "@/lib/price-evaluation"
import { bookedAhead30, realizedOccupancy30, type Availability } from "@/lib/occupancy"
import { buildMarketSignals, type MarketSignals } from "@/lib/seasonality"
import {
  DEFAULT_INPUTS, sanitizeInputs, inBuyBox, hasCountyRecords, analyzeDeal, helocCapacity, resolveOccupancy,
  type MarketAnalysisInputs, type MarketSettings, type ForSaleHome, type CountyRecord, type StrSample,
  type MarketOccupancy,
} from "@/lib/deal-analysis"

const INPUTS_KEY = "marketAnalysisInputs"
const LAST_SCANNED_KEY = "marketLastScanned"
const ALERTED_KEY = "marketAlertedListings"
const STALE_RUN_MS = 10 * 60 * 1000
// Each county lookup is ~3–4s; the whole scan has to fit a 5-minute function
const COUNTY_LOOKUPS_PER_RUN = 20
const COUNTY_REFRESH_DAYS = 30
const STR_BEDROOMS = [2, 3, 4, 5, 6]
const STR_PAGES = 2
// Competitor calendars per market per day — enough for an occupancy read
const CALENDARS_PER_MARKET = 25
// One stay sampled per month a year out, so seasonality has a full year
const SEASONAL_MONTHS = 11
const ALERTS_PER_RUN = 10
// The daily run scans as many markets as fit inside the 5-minute function
// limit, oldest first; the rest go tomorrow.
const SCAN_BUDGET_MS = 230_000

// Defaults start with the owner's own properties listed as equity sources,
// values blank for them to fill in.
async function defaultInputs(): Promise<MarketAnalysisInputs> {
  const properties = await prisma.property.findMany({
    orderBy: { name: "asc" },
    select: { name: true, address: true, city: true, state: true },
  })
  return {
    ...DEFAULT_INPUTS,
    heloc: {
      ...DEFAULT_INPUTS.heloc,
      equitySources: properties.map((p) => ({
        label: p.name,
        address: `${p.address}, ${p.city}, ${p.state}`,
        homeValue: null,
        mortgageBalance: null,
      })),
    },
  }
}

export async function loadInputs(): Promise<MarketAnalysisInputs> {
  const defaults = await defaultInputs()
  const saved = await getSetting(INPUTS_KEY)
  if (!saved) return defaults
  try {
    return sanitizeInputs(JSON.parse(saved), defaults)
  } catch {
    return defaults
  }
}

export async function saveInputs(raw: unknown): Promise<MarketAnalysisInputs> {
  const inputs = sanitizeInputs(raw, await defaultInputs())
  await setSetting(INPUTS_KEY, JSON.stringify(inputs))
  return inputs
}

export async function resetInputs(): Promise<MarketAnalysisInputs> {
  await setSetting(INPUTS_KEY, null)
  return defaultInputs()
}

// Occupancy for each market, read from the competitor calendars collected
// daily. Realized occupancy needs ~30 days of history; until then only
// nights already booked ahead are known, which understates a full year.
async function occupancyByMarket(today: string): Promise<Record<string, MarketOccupancy>> {
  const rows = await prisma.marketCalendarSnapshot.findMany({
    where: { marketId: { not: "" }, capturedOn: { gte: addDays(today, -37) } },
    orderBy: { capturedOn: "asc" },
  })
  const byMarket = new Map<string, Map<string, { capturedOn: string; availability: Availability }[]>>()
  const firstSeen = new Map<string, string>()
  for (const r of rows) {
    if (!byMarket.has(r.marketId)) byMarket.set(r.marketId, new Map())
    const listings = byMarket.get(r.marketId)!
    listings.set(r.listingId, [
      ...(listings.get(r.listingId) ?? []),
      { capturedOn: r.capturedOn, availability: r.availability as Availability },
    ])
    const seen = firstSeen.get(r.marketId)
    if (!seen || r.capturedOn < seen) firstSeen.set(r.marketId, r.capturedOn)
  }

  const out: Record<string, MarketOccupancy> = {}
  for (const [marketId, listings] of byMarket) {
    const ahead: number[] = []
    const realized: number[] = []
    for (const snaps of listings.values()) {
      const a = bookedAhead30(snaps, today)
      if (a !== null) ahead.push(a)
      const r = realizedOccupancy30(snaps, today)
      if (r !== null) realized.push(r)
    }
    const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null)
    const from = firstSeen.get(marketId) ?? today
    out[marketId] = {
      bookedAhead: ahead.length >= 5 ? mean(ahead) : null,
      realized: realized.length >= 5 ? mean(realized) : null,
      listings: listings.size,
      historyDays:
        Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1,
    }
  }
  return out
}

// The owner's own houses: booked nights over the last 12 months from synced
// Airbnb/VRBO bookings. The fallback when a market has no history yet.
// Airbnb's iCal export carries only current and future reservations, so a
// house's Airbnb history begins the day its feed was first read — while
// VRBO's carries the past. Measuring across that seam counts VRBO-only
// months as if they were the whole business and reports an occupancy far
// below the truth. Each house is therefore measured only from the point
// every platform it is listed on has data, and only once that stretch is
// long enough that a single season can't masquerade as the year.
const OWN_OCCUPANCY_MIN_DAYS = 180

async function ownOccupancyLast12Months(): Promise<number | null> {
  const today = todayInOcala()
  const start = addDays(today, -365)
  const properties = await prisma.property.findMany({
    select: {
      airbnbIcalUrl: true,
      vrboIcalUrl: true,
      bookings: { select: { checkIn: true, checkOut: true, platform: true } },
    },
  })
  const rates: number[] = []
  for (const p of properties) {
    if (!p.bookings.length) continue
    const nights = new Set<string>()
    let first = today
    const firstByPlatform = new Map<string, string>()
    for (const b of p.bookings) {
      const checkIn = b.checkIn.toISOString().slice(0, 10)
      const checkOut = b.checkOut.toISOString().slice(0, 10)
      if (checkIn < first) first = checkIn
      const seen = firstByPlatform.get(b.platform)
      if (!seen || checkIn < seen) firstByPlatform.set(b.platform, checkIn)
      for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
        if (d >= start && d < today) nights.add(d)
      }
    }
    // The latest "first booking" among the platforms this house is listed on:
    // before that date at least one channel is missing from the record.
    let covered = first
    for (const [platform, url] of [["airbnb", p.airbnbIcalUrl], ["vrbo", p.vrboIcalUrl]] as const) {
      if (!url) continue
      const firstSeen = firstByPlatform.get(platform)
      if (firstSeen && firstSeen > covered) covered = firstSeen
    }
    const from = covered > start ? covered : start
    const days = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000)
    if (days < OWN_OCCUPANCY_MIN_DAYS) continue
    const booked = [...nights].filter((d) => d >= from).length
    rates.push(booked / days)
  }
  return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null
}

// Similar Airbnbs in the owner's own market, from the Price Evaluation data
async function priceEvaluationOccupancy(): Promise<number | null> {
  const properties = await prisma.property.findMany({ where: { airbnbIcalUrl: { not: null } }, select: { id: true } })
  const values: number[] = []
  for (const p of properties) {
    const ev = await buildPriceEvaluation(p.id)
    const occ = ev?.market?.occupancy30
    if (occ != null) values.push(occ)
  }
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

// Month-to-month shape and the asking-vs-achieved gap, per market, from
// everything collected so far.
async function signalsByMarket(marketIds: string[], today: string): Promise<Record<string, MarketSignals>> {
  const [samples, snapshots] = await Promise.all([
    prisma.strRateSample.findMany({
      where: { marketId: { in: marketIds }, capturedOn: { gte: addDays(today, -120) } },
      select: { marketId: true, listingId: true, checkin: true, nightly: true, capturedOn: true, kind: true },
    }),
    prisma.marketCalendarSnapshot.findMany({
      where: { marketId: { in: marketIds }, capturedOn: { gte: addDays(today, -60) } },
      orderBy: { capturedOn: "asc" },
    }),
  ])
  const out: Record<string, MarketSignals> = {}
  for (const marketId of marketIds) {
    out[marketId] = buildMarketSignals(
      samples.filter((s) => s.marketId === marketId),
      snapshots
        .filter((s) => s.marketId === marketId)
        .map((s) => ({ listingId: s.listingId, capturedOn: s.capturedOn, availability: s.availability as Availability })),
      today,
    )
  }
  return out
}

export async function loadMarketAnalysisData() {
  const today = todayInOcala()
  const [inputs, listings, latestByMarket, lastRun, occupancy, ownOccupancy, priceEvalOccupancy] = await Promise.all([
    loadInputs(),
    // Listings stay visible for a fortnight. A shorter window makes a market
    // that missed its turn in the scan rotation look like it was never set
    // up, which is a lie: the listings are there, they're just not fresh.
    prisma.forSaleListing.findMany({ where: { lastSeenOn: { gte: addDays(today, -14) } }, orderBy: { price: "asc" } }),
    // Each market keeps its own latest capture date. Markets are scanned on a
    // rotation, so a single global "latest date" would wipe out the estimates
    // of every market that didn't happen to run that morning.
    prisma.strRateSample.groupBy({ by: ["marketId"], _max: { capturedOn: true } }),
    prisma.dealScanRun.findFirst({ orderBy: { startedAt: "desc" } }),
    occupancyByMarket(today),
    ownOccupancyLast12Months(),
    priceEvaluationOccupancy(),
  ])
  const captures = latestByMarket
    .filter((m) => m._max.capturedOn)
    .map((m) => ({ marketId: m.marketId, capturedOn: m._max.capturedOn as string }))
  const samples = captures.length
    ? await prisma.strRateSample.findMany({ where: { OR: captures } })
    : []
  const newestCapture = captures.map((c) => c.capturedOn).sort().at(-1) ?? null

  // One sample per Airbnb listing: its average across the sampled stays
  const byListing = new Map<string, { marketId: string; bedrooms: number; lat: number; lng: number; total: number; count: number }>()
  for (const s of samples) {
    const cur = byListing.get(s.listingId)
    if (cur) {
      cur.total += s.nightly
      cur.count++
      cur.bedrooms = Math.max(cur.bedrooms, s.bedrooms)
    } else {
      byListing.set(s.listingId, {
        marketId: s.marketId, bedrooms: s.bedrooms, lat: s.latitude, lng: s.longitude, total: s.nightly, count: 1,
      })
    }
  }
  const strSamples: StrSample[] = [...byListing.entries()].map(([listingId, s]) => ({
    marketId: s.marketId, listingId, bedrooms: s.bedrooms, lat: s.lat, lng: s.lng,
    nightly: Math.round(s.total / s.count),
  }))

  // When each market's listings were last confirmed, so the page can say so
  const listingsSeenByMarket: Record<string, string> = {}
  for (const l of listings) {
    const cur = listingsSeenByMarket[l.marketId]
    if (!cur || l.lastSeenOn > cur) listingsSeenByMarket[l.marketId] = l.lastSeenOn
  }

  const homes: ForSaleHome[] = listings.map((l) => ({
    id: l.id, marketId: l.marketId, url: l.url, address: l.address, city: l.city, zip: l.zip,
    propertyType: l.propertyType, price: l.price, previousPrice: l.previousPrice, priceChangedOn: l.priceChangedOn,
    beds: l.beds, baths: l.baths, sqft: l.sqft, lotSqft: l.lotSqft, yearBuilt: l.yearBuilt,
    daysOnMarket: l.daysOnMarket, hoaMonthly: l.hoaMonthly, latitude: l.latitude, longitude: l.longitude,
    firstSeenOn: l.firstSeenOn,
    county: (l.county as unknown as CountyRecord | null) ?? null,
    countyError: l.countyError,
  }))

  return {
    inputs,
    defaults: await defaultInputs(),
    homes,
    strSamples,
    strCapturedOn: newestCapture,
    listingsSeenByMarket,
    today,
    occupancyByMarket: occupancy,
    signalsByMarket: await signalsByMarket(inputs.markets.map((m) => m.id), today),
    ownOccupancy,
    priceEvalOccupancy,
    lastRun,
  }
}

async function collectStrSamples(market: MarketSettings, today: string) {
  // One weekend and one weekday stay about three weeks out
  const stays: { checkin: string; checkout: string; nights: number }[] = []
  for (const wanted of [5, 2]) {
    let d = addDays(today, 21)
    while (dayOfWeek(d) !== wanted) d = addDays(d, 1)
    stays.push({ checkin: d, checkout: addDays(d, 2), nights: 2 })
  }
  const center = { lat: market.centerLat, lng: market.centerLng }
  const rows = new Map<string, Prisma.StrRateSampleCreateManyInput>()

  for (const bedrooms of STR_BEDROOMS) {
    for (const stay of stays) {
      let cursor: string | undefined
      for (let page = 0; page < STR_PAGES; page++) {
        await sleep(500)
        const parsed = parseSearch(
          await (await airbnbGet(searchUrl(center, market.radiusMiles, stay, bedrooms, 2, false, cursor))).text(),
        )
        if (!parsed) break
        for (const r of parsed.results) {
          if (r.total === null) continue
          const key = `${r.id}:${stay.checkin}`
          // A home appears in every search up to its bedroom count; keep the highest
          rows.set(key, {
            marketId: market.id,
            kind: "current",
            listingId: r.id,
            bedrooms: Math.max(bedrooms, rows.get(key)?.bedrooms ?? 0),
            latitude: r.lat,
            longitude: r.lng,
            checkin: stay.checkin,
            nights: stay.nights,
            nightly: Math.round((r.total / stay.nights) * 100) / 100,
            capturedOn: today,
          })
        }
        cursor = parsed.cursors[page + 1]
        if (!cursor) break
      }
    }
  }
  const data = [...rows.values()]
  for (let i = 0; i < data.length; i += 500) {
    await prisma.strRateSample.createMany({ data: data.slice(i, i + 500), skipDuplicates: true })
  }
  return data
}

// One weekend stay in each of the next 11 months. Prices a year out are
// asking prices, not bookings, but they carry the market's seasonal shape:
// a ski or horse-show town quotes its peak months far higher.
async function collectSeasonalSamples(market: MarketSettings, today: string) {
  const center = { lat: market.centerLat, lng: market.centerLng }
  const bedrooms = Math.max(2, Math.min(6, Math.round(market.buyBox.minBeds ?? 3)))
  const rows: Prisma.StrRateSampleCreateManyInput[] = []

  for (let ahead = 1; ahead <= SEASONAL_MONTHS; ahead++) {
    // The second Friday of that month, which avoids holiday weekends skewing it
    const [y, m] = today.split("-").map(Number)
    const first = new Date(Date.UTC(y, m - 1 + ahead, 1, 12))
    while (first.getUTCDay() !== 5) first.setUTCDate(first.getUTCDate() + 1)
    first.setUTCDate(first.getUTCDate() + 7)
    const checkin = first.toISOString().slice(0, 10)
    const stay = { checkin, checkout: addDays(checkin, 2), nights: 2 }

    await sleep(500)
    const parsed = parseSearch(
      await (await airbnbGet(searchUrl(center, market.radiusMiles, stay, bedrooms, 2, false))).text(),
    )
    if (!parsed) continue
    for (const r of parsed.results) {
      if (r.total === null) continue
      rows.push({
        marketId: market.id,
        kind: "seasonal",
        listingId: r.id,
        bedrooms,
        latitude: r.lat,
        longitude: r.lng,
        checkin: stay.checkin,
        nights: stay.nights,
        nightly: Math.round((r.total / stay.nights) * 100) / 100,
        capturedOn: today,
      })
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    await prisma.strRateSample.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true })
  }
  return rows.length
}

// Daily snapshot of competitors' calendars: the raw material for this
// market's own occupancy, instead of borrowing another market's.
async function collectCompCalendars(
  market: MarketSettings,
  samples: Prisma.StrRateSampleCreateManyInput[],
  today: string,
) {
  const byListing = new Map<string, { lat: number; lng: number }>()
  for (const s of samples) byListing.set(s.listingId, { lat: s.latitude, lng: s.longitude })
  const nearest = [...byListing.entries()]
    .sort(
      (a, b) =>
        milesBetween(market.centerLat, market.centerLng, a[1].lat, a[1].lng) -
        milesBetween(market.centerLat, market.centerLng, b[1].lat, b[1].lng),
    )
    .slice(0, CALENDARS_PER_MARKET)

  let saved = 0
  for (const [listingId] of nearest) {
    await sleep(400)
    const availability = await fetchCalendar(listingId, today, FALLBACK_API_KEY)
    if (!availability) continue
    await prisma.marketCalendarSnapshot.upsert({
      where: { listingId_capturedOn: { listingId, capturedOn: today } },
      create: { listingId, capturedOn: today, marketId: market.id, availability },
      update: { availability, marketId: market.id },
    })
    saved++
  }
  return saved
}

export async function refreshCountyRecord(listingId: string) {
  const listing = await prisma.forSaleListing.findUnique({ where: { id: listingId } })
  if (!listing) return null
  try {
    const record = await lookupCountyRecord(listing.address)
    return prisma.forSaleListing.update({
      where: { id: listingId },
      data: record
        ? { county: record as unknown as Prisma.InputJsonValue, countyError: null, countyFetchedAt: new Date() }
        : { countyError: "Not found in Marion County property records.", countyFetchedAt: new Date() },
    })
  } catch (err) {
    return prisma.forSaleListing.update({
      where: { id: listingId },
      data: { countyError: err instanceof Error ? err.message : "County lookup failed.", countyFetchedAt: new Date() },
    })
  }
}

// Tells the owner the day a qualifying home appears or drops its price —
// the whole point of scanning daily.
async function sendDealAlerts(
  market: MarketSettings,
  inputs: MarketAnalysisInputs,
  today: string,
  occupancy: Record<string, MarketOccupancy>,
  ownOccupancy: number | null,
  priceEvalOccupancy: number | null,
) {
  let alerted: string[] = []
  try {
    alerted = JSON.parse((await getSetting(ALERTED_KEY)) ?? "[]")
  } catch {
    alerted = []
  }
  const seen = new Set(alerted)

  const fresh = await prisma.forSaleListing.findMany({
    where: { marketId: market.id, lastSeenOn: today, OR: [{ firstSeenOn: today }, { priceChangedOn: today }] },
  })
  if (!fresh.length) return 0

  const [samples, admins] = await Promise.all([
    prisma.strRateSample.findMany({ where: { marketId: market.id, capturedOn: today } }),
    prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }),
  ])
  if (!admins.length) return 0

  const strSamples: StrSample[] = samples.map((s) => ({
    marketId: s.marketId, bedrooms: s.bedrooms, lat: s.latitude, lng: s.longitude, nightly: s.nightly,
  }))
  const signals = (await signalsByMarket([market.id], today))[market.id]
  const occ = {
    ...resolveOccupancy(market, occupancy, ownOccupancy, priceEvalOccupancy),
    signals: { months: signals.months, achievedRatio: signals.achievedRatio },
  }
  const available = helocCapacity(inputs.heloc).available

  let sent = 0
  for (const row of fresh) {
    if (sent >= ALERTS_PER_RUN) break
    if (seen.has(row.id)) continue
    const home = { ...row, county: null, countyError: null } as ForSaleHome
    if (!inBuyBox(home, { ...market, buyBox: { ...market.buyBox, poolRequired: false } })) continue
    const m = analyzeDeal(home, market, inputs, strSamples, occ, available)
    if (!m.meetsGoals || m.confidence === "none") continue

    const isNew = row.firstSeenOn === today
    const dropped = row.priceChangedOn === today && (row.previousPrice ?? 0) > row.price
    // A price increase isn't news
    if (!isNew && !dropped) continue
    const title = dropped ? `Price drop meets your goals — ${market.label}` : `New deal in ${market.label}`
    const message =
      `${row.address}, $${row.price.toLocaleString()}` +
      `${dropped && row.previousPrice ? ` (was $${row.previousPrice.toLocaleString()})` : ""}` +
      ` · about $${Math.round(m.cashFlow ?? 0).toLocaleString()}/yr cash flow` +
      `${m.returnOnBorrowed !== null ? `, ${Math.round(m.returnOnBorrowed * 100)}% on borrowed money` : ""}.`

    await prisma.notification.createMany({
      data: admins.map((a) => ({ userId: a.id, type: "GENERAL", title, message })),
    })
    seen.add(row.id)
    sent++
  }

  if (sent) await setSetting(ALERTED_KEY, JSON.stringify([...seen].slice(-500)))
  return sent
}

// marketId scans just that market (the page's "Update now"); otherwise every
// active market runs, which is what the daily cron does.
export async function scanMarket(marketId?: string): Promise<{ ok: boolean; message: string }> {
  await prisma.dealScanRun.updateMany({
    where: { status: "RUNNING", startedAt: { lt: new Date(Date.now() - STALE_RUN_MS) } },
    data: { status: "FAILED", error: "The update stopped before finishing.", finishedAt: new Date() },
  })
  if (await prisma.dealScanRun.findFirst({ where: { status: "RUNNING" } })) {
    return { ok: false, message: "A market scan is already running." }
  }
  const run = await prisma.dealScanRun.create({ data: {} })
  const today = todayInOcala()
  const stats = {
    markets: 0, listings: 0, newListings: 0, priceChanges: 0,
    strSamples: 0, seasonalSamples: 0, calendars: 0, countyLookups: 0, alerts: 0,
  }
  const problems: string[] = []

  try {
    const inputs = await loadInputs()
    let markets = inputs.markets.filter((m) => (marketId ? m.id === marketId : m.active))
    if (!markets.length) throw new Error("No active markets to scan. Add one in your inputs.")

    let lastScanned: Record<string, number> = {}
    try {
      lastScanned = JSON.parse((await getSetting(LAST_SCANNED_KEY)) ?? "{}")
    } catch {
      lastScanned = {}
    }
    if (!marketId) {
      markets = [...markets].sort((a, b) => (lastScanned[a.id] ?? 0) - (lastScanned[b.id] ?? 0))
    }
    const startedAt = Date.now()
    const skipped: string[] = []
    const [occupancy, ownOccupancy, priceEvalOccupancy] = await Promise.all([
      occupancyByMarket(today),
      ownOccupancyLast12Months(),
      priceEvaluationOccupancy(),
    ])

    for (const market of markets) {
      if (!marketId && stats.markets > 0 && Date.now() - startedAt > SCAN_BUDGET_MS) {
        skipped.push(market.label)
        continue
      }
      stats.markets++

      // 1. Homes for sale
      const { listings } = await fetchForSaleListings(
        { lat: market.centerLat, lng: market.centerLng },
        market.radiusMiles,
      )
      const existing = new Map(
        (
          await prisma.forSaleListing.findMany({
            where: { id: { in: listings.map((l) => l.id) } },
            select: { id: true, price: true },
          })
        ).map((l) => [l.id, l.price]),
      )
      const ops = listings.map((l) => {
        const oldPrice = existing.get(l.id)
        const changed = oldPrice !== undefined && oldPrice !== l.price
        if (oldPrice === undefined) stats.newListings++
        if (changed) stats.priceChanges++
        const data = {
          ...l,
          marketId: market.id,
          lastSeenOn: today,
          ...(changed ? { previousPrice: oldPrice, priceChangedOn: today } : {}),
        }
        return prisma.forSaleListing.upsert({
          where: { id: l.id },
          create: { ...data, firstSeenOn: today },
          update: data,
        })
      })
      // Small parallel batches, not one transaction: a busy market can carry
      // 500+ listings, well past the 5-second transaction limit.
      for (let i = 0; i < ops.length; i += 10) await Promise.all(ops.slice(i, i + 10))
      stats.listings += listings.length

      // 2. Airbnb nightly rates, then the calendars behind this market's occupancy
      try {
        const samples = await collectStrSamples(market, today)
        stats.strSamples += samples.length
        stats.calendars += await collectCompCalendars(market, samples, today)
        stats.seasonalSamples += await collectSeasonalSamples(market, today)
      } catch (err) {
        problems.push(`${market.label} Airbnb data: ${err instanceof Error ? err.message : "failed"}`)
      }

      // 3. County records — only Marion County, FL is readable
      if (hasCountyRecords(market)) {
        const staleBefore = new Date(Date.now() - COUNTY_REFRESH_DAYS * 86_400_000)
        const candidates = await prisma.forSaleListing.findMany({
          where: {
            marketId: market.id,
            lastSeenOn: today,
            OR: [{ countyFetchedAt: null }, { countyFetchedAt: { lt: staleBefore } }],
          },
          orderBy: { firstSeenOn: "desc" },
        })
        const inBox = candidates.filter((c) =>
          // pool is only known after the county lookup, so don't filter on it here
          inBuyBox({ ...c, county: null, countyError: null } as ForSaleHome, {
            ...market,
            buyBox: { ...market.buyBox, poolRequired: false },
          }),
        )
        for (const c of inBox.slice(0, COUNTY_LOOKUPS_PER_RUN)) {
          await sleep(1000)
          await refreshCountyRecord(c.id)
          stats.countyLookups++
        }
      }

      // 4. Tell the owner about anything new worth looking at
      try {
        stats.alerts += await sendDealAlerts(market, inputs, today, occupancy, ownOccupancy, priceEvalOccupancy)
      } catch (err) {
        problems.push(`${market.label} alerts: ${err instanceof Error ? err.message : "failed"}`)
      }

      lastScanned[market.id] = Date.now()
    }
    await setSetting(LAST_SCANNED_KEY, JSON.stringify(lastScanned))
    if (skipped.length) problems.push(`Ran out of time for ${skipped.join(", ")} — they go first tomorrow.`)

    await prisma.dealScanRun.update({
      where: { id: run.id },
      data: { status: "COMPLETE", stats, error: problems.join(" · ") || null, finishedAt: new Date() },
    })
    return {
      ok: true,
      message:
        `${stats.markets} market${stats.markets === 1 ? "" : "s"}: ${stats.listings} homes for sale ` +
        `(${stats.newListings} new), ${stats.strSamples} Airbnb rates, ${stats.calendars} calendars, ` +
        `${stats.countyLookups} county records, ${stats.alerts} alerts.` +
        `${skipped.length ? ` ${skipped.join(", ")} left for tomorrow.` : ""}`,
    }
  } catch (err) {
    console.error("[market-analysis]", err)
    const message = err instanceof Error ? err.message : "The market scan failed."
    await prisma.dealScanRun.update({
      where: { id: run.id },
      data: { status: "FAILED", stats, error: message, finishedAt: new Date() },
    })
    return { ok: false, message }
  }
}
