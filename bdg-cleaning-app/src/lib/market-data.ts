// Collects Airbnb market data for the Price Evaluation page: the same raw
// material AirDNA-style tools use. For each of our properties it records
// guest-paid prices for comparable homes nearby on sampled upcoming stays,
// then snapshots each home's availability calendar. Run once a day.

import { prisma } from "@/lib/prisma"
import { addDays, dayOfWeek, todayInOcala } from "@/lib/dates"
import { airbnbListingIdFromIcal } from "@/lib/airbnb-listing"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"

// Airbnb's public web API key (re-read from our listing page each run) and
// the persisted-query hash its listing page uses to load the availability
// calendar. If calendar snapshots start failing, this hash has changed.
export const FALLBACK_API_KEY = "d306zoyjsyarp7ifhu67rjxn52tv0t20"
const CALENDAR_QUERY_HASH = "8f08e03c7bd16fcad3c92a3592c19a8b559a0d0855a84028d1163d4733ed9ade"

// Comps start within 6 miles; when fewer than 15 similar homes turn up
// (large-group and pool homes are scarcer), the search widens to 12.
const COMP_RADIUS_MILES = 6
const WIDE_RADIUS_MILES = 12
const MIN_COMP_SET = 15
const WEEKS_AHEAD = 8
const PAGES_PER_SEARCH = 2
const CALENDARS_PER_PROPERTY = 40
// Kept small and spaced out: ~100 page loads a day, like one person browsing
const REQUEST_GAP_MS = 400
const STALE_RUN_MS = 10 * 60 * 1000

export class AirbnbBlockedError extends Error {}

export { todayInOcala, addDays, dayOfWeek } from "@/lib/dates"

// Sampled 2-night stays: Friday–Sunday for weekends, Tuesday–Thursday for weekdays
// A comparable home must sleep at least ~75% of our guest count
export function compGuestMinimum(guests: number | null): number {
  return Math.max(2, Math.round((guests ?? 2) * 0.75))
}

export function upcomingWindows(today: string) {
  const out: { checkin: string; checkout: string; nights: number }[] = []
  for (let i = 1; i <= WEEKS_AHEAD * 7; i++) {
    const d = addDays(today, i)
    const dow = dayOfWeek(d)
    if (dow === 5 || dow === 2) out.push({ checkin: d, checkout: addDays(d, 2), nights: 2 })
  }
  return out
}

export function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad
  const dLng = (bLng - aLng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(h))
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function airbnbGet(url: string, headers: Record<string, string> = {}): Promise<Response> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9", ...headers },
    cache: "no-store",
  })
  if (res.status === 429 || res.status === 403) {
    throw new AirbnbBlockedError(
      `Airbnb is limiting requests right now (status ${res.status}). The next daily update will try again.`,
    )
  }
  if (!res.ok) throw new Error(`Airbnb returned status ${res.status} for ${new URL(url).pathname}`)
  return res
}

type Node = Record<string, unknown>

function walk(value: unknown, visit: (node: Node) => void) {
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    for (const v of value) walk(v, visit)
    return
  }
  visit(value as Node)
  for (const v of Object.values(value)) walk(v, visit)
}

// Airbnb usually puts page data in <script id="data-deferred-state-0">, but
// some responses carry it in other script blocks, so parse every script that
// holds listing data rather than relying on one tag.
function pageData(html: string): unknown[] | null {
  const blocks: unknown[] = []
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    const body = m[1]
    if (!/StaySearchResult|demandStayListing|StaysPdpSections|pdpAvailabilityCalendar|guestSatisfactionOverall/.test(body)) continue
    try {
      blocks.push(JSON.parse(body))
    } catch {
      const start = body.indexOf("{")
      const end = body.lastIndexOf("}")
      if (start === -1 || end <= start) continue
      try {
        blocks.push(JSON.parse(body.slice(start, end + 1)))
      } catch {
        // not a JSON payload
      }
    }
  }
  return blocks.length ? blocks : null
}

async function fetchOwnListing(id: string) {
  const html = await (await airbnbGet(`https://www.airbnb.com/rooms/${id}`)).text()
  const data = pageData(html)
  if (!data) {
    throw new AirbnbBlockedError("Airbnb sent back your listing page without its data; it may be blocking automated requests.")
  }
  const found: {
    lat: number | null; lng: number | null; rating: number | null; reviews: number | null; guests: number | null; pool: boolean
  } = { lat: null, lng: null, rating: null, reviews: null, guests: null, pool: false }
  walk(data, (n) => {
    if (found.lat === null && typeof n.latitude === "number" && typeof n.longitude === "number") {
      found.lat = n.latitude
      found.lng = n.longitude
    }
    if (found.reviews === null && typeof n.reviewCount === "number") found.reviews = n.reviewCount
    if (found.rating === null && typeof n.guestSatisfactionOverall === "number") found.rating = n.guestSatisfactionOverall
    if (found.guests === null && typeof n.personCapacity === "number") found.guests = n.personCapacity
    if (n.__typename === "AmenityItem" && typeof n.title === "string" && /\bpool\b/i.test(n.title) && n.available !== false) {
      found.pool = true
    }
  })
  if (found.lat === null || found.lng === null) throw new Error(`Couldn't find the map location on Airbnb listing ${id}.`)
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.split(" - ")[0]?.trim() || null
  return {
    lat: found.lat,
    lng: found.lng,
    rating: found.rating,
    reviews: found.reviews,
    guests: found.guests,
    pool: found.pool,
    name: title,
    apiKey: html.match(/"key":"([a-z0-9]{32})"/)?.[1] ?? null,
  }
}

interface SearchResult {
  id: string
  name: string | null
  bedrooms: number | null
  beds: number | null
  baths: number | null
  rating: number | null
  reviews: number | null
  lat: number
  lng: number
  total: number | null
}

function firstNumber(s: string, re: RegExp): number | null {
  const m = s.match(re)
  return m ? Number(m[1].replace(/,/g, "")) : null
}

export function parseSearch(html: string): { results: SearchResult[]; cursors: string[] } | null {
  const data = pageData(html)
  if (!data) return null
  const results = new Map<string, SearchResult>()
  let cursors: string[] = []

  walk(data, (n) => {
    const pagination = n.paginationInfo as Node | undefined
    if (!cursors.length && Array.isArray(pagination?.pageCursors)) cursors = pagination.pageCursors as string[]
    if (n.__typename !== "StaySearchResult") return

    const listing = n.demandStayListing as Node | undefined
    const encodedId = typeof listing?.id === "string" ? listing.id : null
    const id = encodedId ? Buffer.from(encodedId, "base64").toString().split(":")[1] : null
    const coord = (listing?.location as Node | undefined)?.coordinate as Node | undefined
    if (!id || typeof coord?.latitude !== "number" || typeof coord?.longitude !== "number") return

    const content = n.structuredContent as Node | undefined
    const lines = [
      ...((content?.primaryLine as Node[] | undefined) ?? []),
      ...((content?.mapPrimaryLine as Node[] | undefined) ?? []),
    ].map((l) => String(l.body ?? "")).join(" / ")
    const priceLine = ((n.structuredDisplayPrice as Node | undefined)?.primaryLine as Node | undefined) ?? {}
    const priceText = String(priceLine.accessibilityLabel ?? priceLine.discountedPrice ?? priceLine.price ?? "")
    const ratingText = String(n.avgRatingLocalized ?? "")
    const name =
      ((listing?.description as Node | undefined)?.name as Node | undefined)?.localizedStringWithTranslationPreference ??
      (n.nameLocalized as Node | undefined)?.localizedStringWithTranslationPreference ??
      n.subtitle ?? n.title

    results.set(id, {
      id,
      name: typeof name === "string" ? name.trim() : null,
      bedrooms: firstNumber(lines, /(\d+) bedrooms?/),
      beds: firstNumber(lines, /(\d+) beds?\b/),
      baths: firstNumber(lines, /(\d+(?:\.\d+)?) (?:shared |private )?baths?/),
      rating: firstNumber(ratingText, /^(\d\.\d+)/),
      reviews:
        firstNumber(String(n.avgRatingA11yLabel ?? ""), /([\d,]+) reviews?/) ?? firstNumber(ratingText, /\((\d[\d,]*)\)/),
      lat: coord.latitude,
      lng: coord.longitude,
      total: firstNumber(priceText, /\$([\d,]+(?:\.\d+)?)/),
    })
  })
  return { results: [...results.values()], cursors }
}

export function searchUrl(
  center: { lat: number; lng: number },
  radiusMiles: number,
  stay: { checkin: string; checkout: string; nights: number },
  minBedrooms: number | null,
  adults: number,
  pool: boolean,
  cursor?: string,
): string {
  const dLat = radiusMiles / 69
  const dLng = radiusMiles / (69 * Math.cos((center.lat * Math.PI) / 180))
  const p = new URLSearchParams({
    ne_lat: String(center.lat + dLat),
    ne_lng: String(center.lng + dLng),
    sw_lat: String(center.lat - dLat),
    sw_lng: String(center.lng - dLng),
    search_by_map: "true",
    search_type: "user_map_move",
    zoom_level: radiusMiles < 1 ? "16" : "12",
    checkin: stay.checkin,
    checkout: stay.checkout,
    adults: String(adults),
    price_filter_num_nights: String(stay.nights),
  })
  p.append("room_types[]", "Entire home/apt")
  if (pool) p.append("amenities[]", "7")
  if (minBedrooms) p.set("min_bedrooms", String(minBedrooms))
  if (cursor) p.set("cursor", cursor)
  return `https://www.airbnb.com/s/homes?${p}`
}

export async function fetchCalendar(listingId: string, today: string, apiKey: string): Promise<Record<string, boolean> | null> {
  const [year, month] = today.split("-").map(Number)
  const variables = { request: { count: 4, listingId, month, year } }
  const extensions = { persistedQuery: { version: 1, sha256Hash: CALENDAR_QUERY_HASH } }
  const url =
    `https://www.airbnb.com/api/v3/PdpAvailabilityCalendar/${CALENDAR_QUERY_HASH}` +
    `?operationName=PdpAvailabilityCalendar&locale=en&currency=USD` +
    `&variables=${encodeURIComponent(JSON.stringify(variables))}` +
    `&extensions=${encodeURIComponent(JSON.stringify(extensions))}`
  const json = (await (await airbnbGet(url, { "X-Airbnb-API-Key": apiKey })).json().catch(() => null)) as Node | null
  const calendar = ((json?.data as Node | undefined)?.merlin as Node | undefined)?.pdpAvailabilityCalendar as Node | undefined
  const months = calendar?.calendarMonths
  if (!Array.isArray(months)) return null

  const out: Record<string, boolean> = {}
  for (const m of months as Node[]) {
    for (const day of (m.days as Node[] | undefined) ?? []) {
      const date = day.calendarDate
      if (typeof date === "string" && date >= today && typeof day.available === "boolean") out[date] = day.available
    }
  }
  return Object.keys(out).length ? out : null
}

export async function collectMarketData(): Promise<{ ok: boolean; message: string }> {
  await prisma.marketRun.updateMany({
    where: { status: "RUNNING", startedAt: { lt: new Date(Date.now() - STALE_RUN_MS) } },
    data: { status: "FAILED", error: "The update stopped before finishing.", finishedAt: new Date() },
  })
  if (await prisma.marketRun.findFirst({ where: { status: "RUNNING" } })) {
    return { ok: false, message: "A market data update is already running." }
  }

  const run = await prisma.marketRun.create({ data: {} })
  const today = todayInOcala()
  const stats = { properties: 0, searches: 0, skippedPages: 0, comps: 0, quotes: 0, calendars: 0 }

  try {
    const properties = await prisma.property.findMany({ where: { airbnbIcalUrl: { not: null } } })
    let apiKey = FALLBACK_API_KEY
    const listings = new Map<string, Omit<SearchResult, "total"> & { guests: number | null; pool: boolean | null }>()
    const comps = new Map<string, { propertyId: string; listingId: string; distanceMiles: number; isOwn: boolean }>()
    const quotes = new Map<string, { listingId: string; checkin: string; nights: number; total: number; nightly: number; capturedOn: string }>()
    const searchCache = new Map<string, { results: SearchResult[]; cursors: string[] }>()

    // A page occasionally comes back without its data: retry once after a
    // pause, then skip it. Only a streak of empty pages means we're blocked.
    let emptyStreak = 0
    const search = async (url: string) => {
      const cached = searchCache.get(url)
      if (cached) return cached
      for (let attempt = 0; attempt < 2; attempt++) {
        await sleep(attempt === 0 ? REQUEST_GAP_MS : 3000)
        const parsed = parseSearch(await (await airbnbGet(url)).text())
        stats.searches++
        if (parsed) {
          emptyStreak = 0
          searchCache.set(url, parsed)
          return parsed
        }
      }
      stats.skippedPages++
      if (++emptyStreak >= 5) {
        throw new AirbnbBlockedError("Airbnb search pages keep coming back without results; it may be blocking automated requests.")
      }
      return { results: [], cursors: [] }
    }

    // Saved after each property so a later failure doesn't discard earlier work
    const flush = async () => {
      const now = new Date()
      for (const l of listings.values()) {
        const data = {
          name: l.name, bedrooms: l.bedrooms, beds: l.beds, baths: l.baths, rating: l.rating,
          reviews: l.reviews, guests: l.guests, pool: l.pool, latitude: l.lat, longitude: l.lng, lastSeenAt: now,
        }
        // A detail missing from today's page shouldn't erase what we already know
        const update = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null))
        await prisma.marketListing.upsert({ where: { id: l.id }, create: { id: l.id, ...data }, update })
      }
      for (const c of comps.values()) {
        await prisma.marketComp.upsert({
          where: { propertyId_listingId: { propertyId: c.propertyId, listingId: c.listingId } },
          create: { ...c, lastSeenAt: now },
          update: { distanceMiles: c.distanceMiles, isOwn: c.isOwn, lastSeenAt: now },
        })
      }
      const quoteRows = [...quotes.values()]
      for (let i = 0; i < quoteRows.length; i += 500) {
        await prisma.marketQuote.createMany({ data: quoteRows.slice(i, i + 500), skipDuplicates: true })
      }
      stats.comps += [...comps.values()].filter((c) => !c.isOwn).length
      stats.quotes += quoteRows.length
      listings.clear()
      comps.clear()
      quotes.clear()
    }

    const addQuote = (listingId: string, stay: { checkin: string; nights: number }, total: number) => {
      quotes.set(`${listingId}:${stay.checkin}:${stay.nights}`, {
        listingId,
        checkin: stay.checkin,
        nights: stay.nights,
        total,
        nightly: Math.round((total / stay.nights) * 100) / 100,
        capturedOn: today,
      })
    }

    for (const property of properties) {
      const ownId = airbnbListingIdFromIcal(property.airbnbIcalUrl)
      if (!ownId) continue
      stats.properties++

      const own = await fetchOwnListing(ownId)
      if (own.apiKey) apiKey = own.apiKey
      listings.set(ownId, {
        id: ownId, name: own.name, bedrooms: property.bedrooms, beds: null, baths: property.bathrooms,
        rating: own.rating, reviews: own.reviews, guests: own.guests, pool: own.pool, lat: own.lat, lng: own.lng,
      })
      comps.set(`${property.id}:${ownId}`, { propertyId: property.id, listingId: ownId, distanceMiles: 0, isOwn: true })

      // Comparable = at least as many bedrooms, sleeps ~75% of our guest
      // count, and has a pool if ours does. Airbnb applies these as filters.
      const adults = compGuestMinimum(own.guests)
      const windows = upcomingWindows(today)
      let radius = COMP_RADIUS_MILES
      const probe = await search(searchUrl(own, radius, windows[0], property.bedrooms, adults, own.pool))
      if (probe.results.filter((r) => r.id !== ownId).length < MIN_COMP_SET) radius = WIDE_RADIUS_MILES

      for (const stay of windows) {
        let ownPriced = false
        let cursor: string | undefined
        for (let page = 0; page < PAGES_PER_SEARCH; page++) {
          const parsed = await search(searchUrl(own, radius, stay, property.bedrooms, adults, own.pool, cursor))
          for (const r of parsed.results) {
            if (r.total === null) continue
            if (r.id === ownId) {
              ownPriced = true
              addQuote(ownId, stay, r.total)
              continue
            }
            const distanceMiles = milesBetween(own.lat, own.lng, r.lat, r.lng)
            if (distanceMiles > radius) continue
            const { total, ...info } = r
            listings.set(r.id, { ...info, guests: null, pool: own.pool ? true : null })
            comps.set(`${property.id}:${r.id}`, {
              propertyId: property.id, listingId: r.id, distanceMiles: Math.round(distanceMiles * 10) / 10, isOwn: false,
            })
            addQuote(r.id, stay, total)
          }
          cursor = parsed.cursors[page + 1]
          if (!cursor) break
        }

        // Our own home rarely shows in the wide search; a tight search right
        // around it returns its price whenever those nights are open.
        if (!ownPriced) {
          const parsed = await search(searchUrl(own, 0.25, stay, null, adults, false))
          const mine = parsed.results.find((r) => r.id === ownId)
          if (mine?.total != null) addQuote(ownId, stay, mine.total)
        }
      }
      await flush()
    }

    // Calendars: our own listings plus the closest comps for each property
    const calendarIds = new Set<string>()
    for (const property of properties) {
      const tracked = await prisma.marketComp.findMany({
        where: { propertyId: property.id, lastSeenAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
        orderBy: [{ isOwn: "desc" }, { distanceMiles: "asc" }],
        take: CALENDARS_PER_PROPERTY + 1,
        select: { listingId: true },
      })
      for (const t of tracked) calendarIds.add(t.listingId)
    }
    for (const listingId of calendarIds) {
      await sleep(REQUEST_GAP_MS)
      const availability = await fetchCalendar(listingId, today, apiKey)
      if (!availability) continue
      await prisma.marketCalendarSnapshot.upsert({
        where: { listingId_capturedOn: { listingId, capturedOn: today } },
        create: { listingId, capturedOn: today, availability },
        update: { availability },
      })
      stats.calendars++
    }
    if (calendarIds.size > 0 && stats.calendars === 0) {
      throw new Error("Prices were saved, but Airbnb didn't return any calendars. Its calendar lookup may have changed.")
    }

    await prisma.marketRun.update({
      where: { id: run.id },
      data: { status: "COMPLETE", stats, finishedAt: new Date() },
    })
    return { ok: true, message: `Updated ${stats.comps} homes, ${stats.quotes} prices, ${stats.calendars} calendars.` }
  } catch (err) {
    console.error("[market-data]", err)
    const message = err instanceof Error ? err.message : "The market data update failed."
    await prisma.marketRun.update({
      where: { id: run.id },
      data: { status: "FAILED", stats, error: message, finishedAt: new Date() },
    })
    return { ok: false, message }
  }
}
