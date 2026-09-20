// Reading occupancy out of daily calendar snapshots, shared by Price
// Evaluation and Market Analysis.
//
// A night that was open in an earlier snapshot and taken in a later one was
// booked. A long unbroken run of unavailable nights is the owner blocking the
// calendar, not guests, so it counts as neither — the same rule AirDNA uses
// when it separates blocked nights from bookings.

import { addDays } from "@/lib/market-data"

export type Availability = Record<string, boolean>
export type DayState = "open" | "booked" | "blocked"

export const OWNER_BLOCK_NIGHTS = 21
export const MIN_KNOWN_NIGHTS = 10

export function classify(av: Availability): Map<string, DayState> {
  const dates = Object.keys(av).sort()
  const out = new Map<string, DayState>()
  let i = 0
  while (i < dates.length) {
    if (av[dates[i]]) {
      out.set(dates[i], "open")
      i++
      continue
    }
    let j = i + 1
    while (j < dates.length && !av[dates[j]] && dates[j] === addDays(dates[j - 1], 1)) j++
    const state: DayState = j - i >= OWNER_BLOCK_NIGHTS ? "blocked" : "booked"
    for (let k = i; k < j; k++) out.set(dates[k], state)
    i = j
  }
  return out
}

export function bookedShare(states: (DayState | undefined)[], minKnown = MIN_KNOWN_NIGHTS): number | null {
  let booked = 0
  let open = 0
  for (const s of states) {
    if (s === "booked") booked++
    else if (s === "open") open++
  }
  return booked + open >= minKnown ? booked / (booked + open) : null
}

export function nextDays(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(today, i))
}

// Nights already taken for the month ahead. Runs low as a yearly figure,
// because nights close to today keep filling in.
export function bookedAhead30(snaps: { capturedOn: string; availability: Availability }[], today: string): number | null {
  if (!snaps.length) return null
  const states = classify(snaps[snaps.length - 1].availability)
  return bookedShare(nextDays(today, 30).map((d) => states.get(d)))
}

// Last 30 nights: needs at least two snapshots covering each night, so this
// only starts returning a number after about a month of daily collection.
export function realizedOccupancy30(
  snaps: { capturedOn: string; availability: Availability }[],
  today: string,
): number | null {
  const states: (DayState | undefined)[] = []
  for (let back = 30; back >= 1; back--) {
    const night = addDays(today, -back)
    const seen = snaps.filter((s) => s.capturedOn <= night && night in s.availability)
    if (seen.length < 2) continue
    const last = seen[seen.length - 1].availability[night]
    if (last) states.push("open")
    else if (seen[0].availability[night]) states.push("booked")
  }
  return bookedShare(states)
}
