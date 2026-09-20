// Two things the daily collection can tell us that a single snapshot can't:
//
// 1. Seasonality — how rates and bookings move month to month. Stored as an
//    index around 1.0, so it changes how a year is *distributed*, never the
//    level the owner set. A 1.4 index in March means March runs 40% above
//    that market's average.
// 2. Asking vs achieved — competitors' asking prices are what we can see, but
//    the nights that actually book are often the cheaper ones. Once a night
//    has passed we know whether it booked, so we can measure the gap.

import { classify, type Availability } from "@/lib/occupancy"

export interface MonthSignal {
  month: number // 0 = January
  rateIndex: number
  occupancyIndex: number
  samples: number
  nights: number
}

export interface MarketSignals {
  months: MonthSignal[]
  // Achieved ÷ asking, from nights that have since passed
  achievedRatio: number | null
  achievedNights: number
  askingMedian: number | null
  achievedMedian: number | null
  historyDays: number
}

export interface RateSample {
  listingId: string
  checkin: string
  nightly: number
  capturedOn: string
  kind?: string
}

export interface CalendarSnapshot {
  listingId: string
  capturedOn: string
  availability: Availability
}

const MIN_SAMPLES_PER_MONTH = 5
const MIN_NIGHTS_PER_MONTH = 20
const MIN_ACHIEVED_NIGHTS = 15

function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function monthOf(ymd: string): number {
  return Number(ymd.slice(5, 7)) - 1
}

export function buildMarketSignals(
  samples: RateSample[],
  snapshots: CalendarSnapshot[],
  today: string,
): MarketSignals {
  // ── Rate by month ──────────────────────────────────────────────────────
  // Keep the newest quote for each listing-and-date, so repeated collection
  // doesn't weight older prices more heavily.
  const newest = new Map<string, RateSample>()
  for (const s of samples) {
    const key = `${s.listingId}:${s.checkin}`
    const cur = newest.get(key)
    if (!cur || s.capturedOn > cur.capturedOn) newest.set(key, s)
  }
  // Only the seasonal sampling can be compared month to month: same size of
  // home, same point in the month. Mixing in the near-term sampling, which
  // covers every bedroom tier, would make whichever month it lands in look
  // like a peak.
  const seasonal = [...newest.values()].filter((s) => s.kind === "seasonal")
  const forIndex = seasonal.length >= MIN_SAMPLES_PER_MONTH ? seasonal : [...newest.values()]
  const byMonth = new Map<number, number[]>()
  for (const s of forIndex) {
    const m = monthOf(s.checkin)
    byMonth.set(m, [...(byMonth.get(m) ?? []), s.nightly])
  }
  const monthRate = new Map<number, number>()
  for (const [m, values] of byMonth) {
    if (values.length < MIN_SAMPLES_PER_MONTH) continue
    const med = median(values)
    if (med !== null) monthRate.set(m, med)
  }
  const rateBase = median([...monthRate.values()])

  // ── Bookings by month ──────────────────────────────────────────────────
  // From the most recent snapshot of each competitor's calendar. Nights the
  // owner blocked don't count either way.
  const latest = new Map<string, CalendarSnapshot>()
  for (const s of snapshots) {
    const cur = latest.get(s.listingId)
    if (!cur || s.capturedOn > cur.capturedOn) latest.set(s.listingId, s)
  }
  const monthNights = new Map<number, { booked: number; open: number }>()
  for (const snap of latest.values()) {
    for (const [date, state] of classify(snap.availability)) {
      if (date < today || state === "blocked") continue
      const m = monthOf(date)
      const cur = monthNights.get(m) ?? { booked: 0, open: 0 }
      if (state === "booked") cur.booked++
      else cur.open++
      monthNights.set(m, cur)
    }
  }
  const monthOcc = new Map<number, number>()
  for (const [m, n] of monthNights) {
    if (n.booked + n.open < MIN_NIGHTS_PER_MONTH) continue
    monthOcc.set(m, n.booked / (n.booked + n.open))
  }
  const occBase = median([...monthOcc.values()])

  const months: MonthSignal[] = []
  for (let m = 0; m < 12; m++) {
    const rate = monthRate.get(m)
    const occ = monthOcc.get(m)
    if (rate === undefined && occ === undefined) continue
    months.push({
      month: m,
      rateIndex: rate !== undefined && rateBase ? rate / rateBase : 1,
      occupancyIndex: occ !== undefined && occBase ? occ / occBase : 1,
      samples: byMonth.get(m)?.length ?? 0,
      nights: (monthNights.get(m)?.booked ?? 0) + (monthNights.get(m)?.open ?? 0),
    })
  }

  // ── Asking vs achieved ─────────────────────────────────────────────────
  // A night is judged once it's in the past: the last snapshot that still
  // listed it tells us whether it ended up taken.
  const askingAll: number[] = []
  const achieved: number[] = []
  const snapsByListing = new Map<string, CalendarSnapshot[]>()
  for (const s of snapshots) snapsByListing.set(s.listingId, [...(snapsByListing.get(s.listingId) ?? []), s])
  for (const s of newest.values()) {
    if (s.checkin >= today) continue
    const listingSnaps = (snapsByListing.get(s.listingId) ?? [])
      .filter((x) => s.checkin in x.availability)
      .sort((a, b) => a.capturedOn.localeCompare(b.capturedOn))
    if (!listingSnaps.length) continue
    askingAll.push(s.nightly)
    const last = listingSnaps[listingSnaps.length - 1]
    if (!last.availability[s.checkin]) achieved.push(s.nightly)
  }
  const askingMedian = median(askingAll)
  const achievedMedian = achieved.length >= MIN_ACHIEVED_NIGHTS ? median(achieved) : null

  const capturedOns = samples.map((s) => s.capturedOn).sort()
  const first = capturedOns[0]
  const historyDays = first
    ? Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 86_400_000) + 1
    : 0

  return {
    months,
    achievedRatio:
      achievedMedian !== null && askingMedian ? Math.min(1.5, achievedMedian / askingMedian) : null,
    achievedNights: achieved.length,
    askingMedian,
    achievedMedian,
    historyDays,
  }
}
