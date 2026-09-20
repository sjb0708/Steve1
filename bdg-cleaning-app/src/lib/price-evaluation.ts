// Turns collected market data into the AirDNA-style report: market rates,
// occupancy, RevPAR, revenue estimates, a comp set, and a suggested rate for
// each sampled stay.

import { prisma } from "@/lib/prisma"
import { airbnbListingIdFromIcal } from "@/lib/airbnb-listing"
import { todayInOcala, addDays, dayOfWeek, compGuestMinimum } from "@/lib/market-data"
import type { PriceEvaluation, StayWindowStat, CompRow } from "@/lib/price-evaluation-types"

import { classify, bookedShare, nextDays, realizedOccupancy30, type Availability } from "@/lib/occupancy"

const MIN_COMPS = 5

function sorted(values: number[]): number[] {
  return [...values].sort((a, b) => a - b)
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null
  const s = sorted(values)
  const idx = (s.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return s[lo] + (s[hi] - s[lo]) * (idx - lo)
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

function dollars(v: number | null): number | null {
  return v === null ? null : Math.round(v)
}

function blend(weekend: number | null, weekday: number | null): number | null {
  if (weekend !== null && weekday !== null) return (2 * weekend + 5 * weekday) / 7
  return weekend ?? weekday
}

// Demand is judged against the other sampled stays of the same kind: dates
// eight weeks out always look lightly booked, so a fixed cutoff would call
// every far-off weekday "soft."
function suggestRate(
  values: number[],
  demand: number | null,
  typicalDemand: number | null,
  ownRating: number | null,
  marketRating: number | null,
): { price: number | null; note: string } {
  if (values.length < MIN_COMPS) return { price: null, note: "Too few similar homes open on these dates to compare" }
  let p = 0.5
  const notes: string[] = []
  const booked = demand === null ? "" : `${Math.round(demand * 100)}% of similar homes booked`
  const typical = typicalDemand === null ? "" : ` vs ${Math.round(typicalDemand * 100)}% typical`
  if (demand !== null && (demand >= 0.7 || (typicalDemand !== null && demand >= typicalDemand + 0.15))) {
    p += 0.2
    notes.push(`busier than usual, ${booked}${typical}`)
  } else if (demand !== null && typicalDemand !== null && demand <= typicalDemand - 0.15) {
    p -= 0.1
    notes.push(`slower than usual, ${booked}${typical}`)
  }
  if (ownRating !== null && marketRating !== null) {
    if (ownRating >= marketRating + 0.05) {
      p += 0.1
      notes.push("your rating is above the market")
    } else if (ownRating <= marketRating - 0.1) {
      p -= 0.1
      notes.push("your rating is below the market")
    }
  }
  p = Math.min(0.85, Math.max(0.2, p))
  const price = percentile(values, p)
  const note = notes.length ? notes.join("; ") : "demand in line with nearby dates, priced at the market middle"
  return { price: price === null ? null : Math.round(price / 5) * 5, note: note[0].toUpperCase() + note.slice(1) }
}

export async function buildPriceEvaluation(propertyId: string): Promise<PriceEvaluation | null> {
  const property = await prisma.property.findUnique({ where: { id: propertyId } })
  if (!property) return null

  const today = todayInOcala()
  const empty: PriceEvaluation = {
    propertyId,
    propertyName: property.name,
    ownListingId: airbnbListingIdFromIcal(property.airbnbIcalUrl),
    hasData: false,
    lastCapturedOn: null,
    firstCapturedOn: null,
    historyDays: 0,
    criteria: null,
    market: null,
    you: null,
    windows: [],
    comps: [],
  }

  const comps = await prisma.marketComp.findMany({
    where: { propertyId, lastSeenAt: { gte: new Date(Date.now() - 14 * 86_400_000) } },
    include: { listing: true },
  })
  const ids = comps.map((c) => c.listingId)
  if (!ids.length) return empty

  const [latest, first] = await Promise.all([
    prisma.marketQuote.findFirst({ where: { listingId: { in: ids } }, orderBy: { capturedOn: "desc" }, select: { capturedOn: true } }),
    prisma.marketQuote.findFirst({ where: { listingId: { in: ids } }, orderBy: { capturedOn: "asc" }, select: { capturedOn: true } }),
  ])
  if (!latest || !first) return empty

  const [quotes, snapshots] = await Promise.all([
    prisma.marketQuote.findMany({
      where: { listingId: { in: ids }, capturedOn: latest.capturedOn, checkin: { gte: today } },
    }),
    prisma.marketCalendarSnapshot.findMany({
      where: { listingId: { in: ids }, capturedOn: { gte: addDays(today, -37) } },
      orderBy: { capturedOn: "asc" },
    }),
  ])

  const quotesBy = new Map<string, typeof quotes>()
  for (const q of quotes) quotesBy.set(q.listingId, [...(quotesBy.get(q.listingId) ?? []), q])
  const snapsBy = new Map<string, { capturedOn: string; availability: Availability }[]>()
  for (const s of snapshots) {
    snapsBy.set(s.listingId, [
      ...(snapsBy.get(s.listingId) ?? []),
      { capturedOn: s.capturedOn, availability: s.availability as Availability },
    ])
  }

  const analyzed = comps.map((c) => {
    const q = quotesBy.get(c.listingId) ?? []
    const weekendNightly = mean(q.filter((x) => dayOfWeek(x.checkin) === 5).map((x) => x.nightly))
    const weekdayNightly = mean(q.filter((x) => dayOfWeek(x.checkin) !== 5).map((x) => x.nightly))
    const blended = blend(weekendNightly, weekdayNightly)
    const snaps = snapsBy.get(c.listingId) ?? []
    const states = snaps.length ? classify(snaps[snaps.length - 1].availability) : null
    const bookedAhead30 = states ? bookedShare(nextDays(today, 30).map((d) => states.get(d))) : null
    const occupancy30 = realizedOccupancy30(snaps, today)
    const occ = occupancy30 ?? bookedAhead30
    const row: CompRow = {
      listingId: c.listingId,
      name: c.listing.name,
      bedrooms: c.listing.bedrooms,
      beds: c.listing.beds,
      baths: c.listing.baths,
      rating: c.listing.rating,
      reviews: c.listing.reviews,
      distanceMiles: c.distanceMiles,
      weekendNightly: dollars(weekendNightly),
      weekdayNightly: dollars(weekdayNightly),
      bookedAhead30,
      occupancy30,
      estMonthlyRevenue: blended !== null && occ !== null ? dollars(blended * 30 * occ) : null,
    }
    return { isOwn: c.isOwn, guests: c.listing.guests, pool: c.listing.pool, row, blended, states, quotes: q }
  })

  const own = analyzed.find((a) => a.isOwn) ?? null
  const market = analyzed.filter((a) => !a.isOwn && a.quotes.length > 0)

  const marketBlended = market.map((m) => m.blended).filter((v): v is number => v !== null)
  const marketRatings = market.map((m) => m.row.rating).filter((v): v is number => v !== null)
  const marketRating = percentile(marketRatings, 0.5)
  const aheadValues = market.map((m) => m.row.bookedAhead30).filter((v): v is number => v !== null)
  const occValues = market.map((m) => m.row.occupancy30).filter((v): v is number => v !== null)
  const marketAhead = aheadValues.length >= MIN_COMPS ? mean(aheadValues) : null
  const marketOcc = occValues.length >= MIN_COMPS ? mean(occValues) : null
  const occForRevenue = marketOcc ?? marketAhead
  const blendedMedian = percentile(marketBlended, 0.5)

  const annual = (nightly: number | null) =>
    nightly !== null && occForRevenue !== null ? Math.round(nightly * occForRevenue * 365) : null
  const low = annual(percentile(marketBlended, 0.25))
  const mid = annual(blendedMedian)
  const high = annual(percentile(marketBlended, 0.75))

  const ownRating = own?.row.rating ?? null
  const ownOcc = own ? own.row.occupancy30 ?? own.row.bookedAhead30 : null

  const checkins = [...new Set(quotes.map((q) => q.checkin))].sort()
  const stays = checkins.map((checkin) => {
    const nights = quotes.find((q) => q.checkin === checkin)?.nights ?? 2
    const stayNights = nextDays(checkin, nights)
    let taken = 0
    let open = 0
    for (const m of market) {
      const s = m.states ? stayNights.map((d) => m.states!.get(d)) : []
      if (!s.length || s.some((x) => x === undefined || x === "blocked")) continue
      if (s.some((x) => x === "open")) open++
      else taken++
    }
    return {
      checkin,
      nights,
      stayNights,
      kind: (dayOfWeek(checkin) === 5 ? "weekend" : "weekday") as StayWindowStat["kind"],
      marketBookedPct: taken + open >= MIN_COMPS ? taken / (taken + open) : null,
    }
  })
  const typicalDemand = (kind: StayWindowStat["kind"]) =>
    mean(stays.filter((s) => s.kind === kind && s.marketBookedPct !== null).map((s) => s.marketBookedPct!))

  const windows: StayWindowStat[] = stays.map(({ checkin, nights, stayNights, kind, marketBookedPct }) => {
    const values = market.flatMap((m) => m.quotes.filter((q) => q.checkin === checkin).map((q) => q.nightly))
    const ownStates = own?.states ? stayNights.map((d) => own.states!.get(d)) : null
    const yourAvailable = ownStates && ownStates.every((x) => x !== undefined) ? ownStates.every((x) => x === "open") : null
    const yourQuote = own?.quotes.find((q) => q.checkin === checkin)
    const suggestion = suggestRate(values, marketBookedPct, typicalDemand(kind), ownRating, marketRating)

    return {
      checkin,
      checkout: addDays(checkin, nights),
      kind,
      compCount: values.length,
      p25: dollars(percentile(values, 0.25)),
      median: dollars(percentile(values, 0.5)),
      p75: dollars(percentile(values, 0.75)),
      yourPrice: yourQuote ? dollars(yourQuote.nightly) : null,
      yourAvailable,
      marketBookedPct,
      suggested: suggestion.price,
      suggestionNote: suggestion.note,
    }
  })

  const historyDays =
    Math.round((Date.parse(`${latest.capturedOn}T12:00:00Z`) - Date.parse(`${first.capturedOn}T12:00:00Z`)) / 86_400_000) + 1

  return {
    ...empty,
    hasData: true,
    lastCapturedOn: latest.capturedOn,
    firstCapturedOn: first.capturedOn,
    historyDays,
    criteria: {
      minBedrooms: property.bedrooms,
      minGuests: own?.guests != null ? compGuestMinimum(own.guests) : null,
      pool: own?.pool ?? null,
      radiusMiles: market.length ? Math.ceil(Math.max(...market.map((m) => m.row.distanceMiles))) : null,
    },
    market: {
      compCount: market.length,
      weekendMedian: dollars(percentile(market.map((m) => m.row.weekendNightly).filter((v): v is number => v !== null), 0.5)),
      weekdayMedian: dollars(percentile(market.map((m) => m.row.weekdayNightly).filter((v): v is number => v !== null), 0.5)),
      blendedMedian: dollars(blendedMedian),
      bookedAhead30: marketAhead,
      occupancy30: marketOcc,
      revpar: blendedMedian !== null && occForRevenue !== null ? dollars(blendedMedian * occForRevenue) : null,
      estAnnualRevenue: low !== null && mid !== null && high !== null ? { low, mid, high } : null,
      medianRating: marketRating,
    },
    you: own
      ? {
          weekendAvg: own.row.weekendNightly,
          weekdayAvg: own.row.weekdayNightly,
          blended: dollars(own.blended),
          bookedAhead30: own.row.bookedAhead30,
          occupancy30: own.row.occupancy30,
          revpar: own.blended !== null && ownOcc !== null ? dollars(own.blended * ownOcc) : null,
          estAnnualRevenue: own.blended !== null && ownOcc !== null ? Math.round(own.blended * ownOcc * 365) : null,
          rating: ownRating,
          reviews: own.row.reviews,
          pricePercentile:
            own.blended !== null && marketBlended.length >= MIN_COMPS
              ? marketBlended.filter((v) => v < own.blended!).length / marketBlended.length
              : null,
        }
      : null,
    windows,
    comps: market.map((m) => m.row).sort((a, b) => a.distanceMiles - b.distanceMiles),
  }
}
