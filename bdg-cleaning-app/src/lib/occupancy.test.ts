// The rules that decide whether a night on someone else's calendar counts as
// a booking, an owner's block, or nothing at all.
import { test } from "node:test"
import assert from "node:assert/strict"
import { classify, bookedShare, realizedOccupancy30, bookedAhead30, OWNER_BLOCK_NIGHTS } from "./occupancy"

const days = (from: string, count: number, open: boolean) => {
  const out: Record<string, boolean> = {}
  const d = new Date(`${from}T12:00:00Z`)
  for (let i = 0; i < count; i++) {
    out[d.toISOString().slice(0, 10)] = open
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

test("a short unavailable run is a booking, a long one is the owner blocking", () => {
  const short = classify({ ...days("2026-01-01", 3, true), ...days("2026-01-04", 4, false), ...days("2026-01-08", 3, true) })
  assert.equal(short.get("2026-01-05"), "booked", "4 nights is a guest")

  const long = classify({ ...days("2026-01-01", 3, true), ...days("2026-01-04", OWNER_BLOCK_NIGHTS, false) })
  assert.equal(long.get("2026-01-05"), "blocked", `${OWNER_BLOCK_NIGHTS} nights is the owner`)
})

test("the block rule turns on exactly at the threshold, not before", () => {
  const justUnder = classify(days("2026-01-01", OWNER_BLOCK_NIGHTS - 1, false))
  assert.equal(justUnder.get("2026-01-01"), "booked")
  const atThreshold = classify(days("2026-01-01", OWNER_BLOCK_NIGHTS, false))
  assert.equal(atThreshold.get("2026-01-01"), "blocked")
})

test("a gap in the dates breaks the run, so two short stays don't become a block", () => {
  // 15 unavailable nights, a missing day, then 15 more: neither reaches 21
  const a = days("2026-01-01", 15, false)
  const b = days("2026-01-17", 15, false)
  const states = classify({ ...a, ...b })
  assert.equal(states.get("2026-01-01"), "booked")
  assert.equal(states.get("2026-01-17"), "booked")
})

test("blocked nights count as neither booked nor available", () => {
  // 5 booked, 5 open, 21 blocked → 50%, because the block is set aside
  assert.equal(bookedShare([...Array(5).fill("booked"), ...Array(5).fill("open"), ...Array(21).fill("blocked")]), 0.5)
})

test("too few known nights gives no answer rather than a bad one", () => {
  assert.equal(bookedShare(["booked", "open"]), null, "2 nights is not a sample")
  assert.equal(bookedShare(["booked", "open"], 2), 0.5, "unless you say it is")
})

test("a night only counts as booked once two snapshots have seen it change", () => {
  const today = "2026-02-01"
  const night = "2026-01-20"
  // One snapshot: nothing can be inferred, the night was never seen open
  const one = [{ capturedOn: "2026-01-19", availability: { [night]: false } }]
  assert.equal(realizedOccupancy30(one, today), null)

  // Open, then taken: that is a booking
  const two = [
    { capturedOn: "2026-01-10", availability: { [night]: true } },
    { capturedOn: "2026-01-19", availability: { [night]: false } },
  ]
  assert.equal(realizedOccupancy30(two, today), null, "one night is still too small a sample")
})

test("nights ahead are read from the most recent snapshot", () => {
  const today = "2026-02-01"
  const av: Record<string, boolean> = {}
  for (let i = 0; i < 30; i++) {
    const d = new Date(`${today}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + i)
    av[d.toISOString().slice(0, 10)] = i >= 15 // first 15 nights taken, rest open
  }
  const share = bookedAhead30([{ capturedOn: today, availability: av }], today)
  assert.equal(share, 0.5, "15 of 30 nights taken")
})
