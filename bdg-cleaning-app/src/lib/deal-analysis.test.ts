// Known-answer tests for the money math. Every number below is worked out by
// hand in the comments, so a failure tells you which assumption moved rather
// than only that something changed.
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  DEFAULT_INPUTS, DEFAULT_MARKETS, DEFAULT_EXPENSES, DEFAULT_BUY_BOX,
  analyzeDeal, maxOffer, estimateNightly, inBuyBox, cleaningSpreadPerNight, project,
  type ForSaleHome, type StrSample, type MarketSettings, type MarketAnalysisInputs,
} from "./deal-analysis"

const near = (a: number | null, b: number, tol = 0.51, what = "") =>
  assert.ok(a !== null && Math.abs(a - b) <= tol, `${what} expected ≈${b}, got ${a}`)

const market = (patch: Partial<MarketSettings> = {}): MarketSettings => ({
  ...DEFAULT_MARKETS[0],
  expenses: { ...DEFAULT_EXPENSES, ...(patch.expenses ?? {}) },
  ...patch,
})

const inputs = (patch: Partial<MarketAnalysisInputs> = {}): MarketAnalysisInputs => ({
  ...DEFAULT_INPUTS,
  ...patch,
})

const home = (patch: Partial<ForSaleHome> = {}): ForSaleHome => ({
  id: "h1", marketId: "ocala-fl", url: "", address: "1 Test St", city: "Ocala", zip: "34470",
  propertyType: "Single Family Residential", price: 300_000, previousPrice: null, priceChangedOn: null,
  beds: 3, baths: 2, sqft: 1500, lotSqft: null, yearBuilt: 2000, daysOnMarket: 10, hoaMonthly: null,
  latitude: 29.1872, longitude: -82.1401, firstSeenOn: "2026-09-01", county: null, countyError: null,
  ...patch,
})

// Four identical comps on top of the house: the median is unambiguous.
const comps = (guestNightly: number): StrSample[] =>
  Array.from({ length: 4 }, () => ({
    marketId: "ocala-fl", bedrooms: 3, lat: 29.1872, lng: -82.1401, nightly: guestNightly,
  }))

const measured = { market: 0.5, own: null, bookedAhead: null, listings: 10, historyDays: 30 }

test("cleaning fee is re-spread from the 2-night sample to the assumed stay", () => {
  // $120 a turn, sampled over 2 nights, spent over 3: 120 × (1/2 − 1/3) = $20
  near(cleaningSpreadPerNight(inputs(), market()), 20, 0.001, "spread at 3-night stay")
  // Sampling length equals stay length, so there is nothing to re-spread
  const i = inputs({ revenue: { ...DEFAULT_INPUTS.revenue, avgStayNights: 2 } })
  near(cleaningSpreadPerNight(i, market()), 0, 0.001, "spread at 2-night stay")
})

test("host nightly strips Airbnb's guest fee and the over-spread cleaning fee", () => {
  // Guest pays $228/night. Host side: 228 / 1.14 = $200, less the $20 spread = $180
  const est = estimateNightly(home(), comps(228), inputs(), market())
  near(est.guestNightly, 228, 0.01, "guest nightly")
  near(est.hostNightly, 180, 0.01, "host nightly")
})

test("a comp set of fewer than three gives no estimate at all", () => {
  const est = estimateNightly(home(), comps(228).slice(0, 2), inputs(), market())
  assert.equal(est.guestNightly, null)
  assert.equal(est.hostNightly, null)
})

test("revenue, expenses and cash flow tie out by hand", () => {
  // $180/night host rate × 365 × 50% occupancy = $32,850 revenue
  const m = analyzeDeal(home(), market(), inputs(), comps(228), measured, 0)
  near(m.nightly, 180, 0.01, "nightly")
  near(m.occupancy, 0.5, 0.001, "occupancy")
  near(m.nightsBooked, 182.5, 0.01, "nights booked")
  near(m.revenue, 32_850, 1, "revenue")

  const e = m.expenses!
  near(e.hostFees, 32_850 * 0.03, 1, "host fee 3%")          // 985.50
  near(e.cleaning, (182.5 / 3) * 120, 1, "cleaning")          // 60.83 turns × $120 = 7,300
  near(e.utilities, 450 * 12, 1, "utilities")                 // 5,400
  near(e.insurance, 3_600, 1, "insurance")
  near(e.other, 250 * 12, 1, "other")                         // 3,000
  near(e.propertyTax, 300_000 * 0.018, 1, "property tax")     // 5,400
  near(e.suppliesMaintenance, 32_850 * 0.06, 1, "supplies")   // 1,971
  near(e.capexReserve, 32_850 * 0.05, 1, "capex")             // 1,642.50
  near(e.management, 0, 0.01, "management at 0%")
  near(e.total, 985.5 + 7_300 + 5_400 + 3_600 + 3_000 + 5_400 + 1_971 + 1_642.5, 2, "total expenses")
  near(m.noi, 32_850 - e.total, 2, "NOI = revenue − expenses")
  assert.equal(m.cashFlow, m.noi! - m.mortgageAnnual - m.helocAnnual)
})

test("break-even occupancy is the share of nights that covers the fixed bill", () => {
  const m = analyzeDeal(home(), market(), inputs(), comps(228), measured, 0)
  // At exactly break-even the deal neither makes nor loses money
  const atBreakEven = analyzeDeal(
    home(), { ...market(), occupancyPct: m.breakEvenOccupancy! * 100 }, inputs(), comps(228), measured, 0,
  )
  near(atBreakEven.cashFlow, 0, 25, "cash flow at break-even occupancy")
})

test("the 20% down payment, closing costs and furnishing make up the cash needed", () => {
  const m = analyzeDeal(home(), market(), inputs(), comps(228), measured, 0)
  near(m.downPayment, 60_000, 1, "20% of 300k")
  near(m.closingCosts, 9_000, 1, "3% of 300k")
  near(m.furnishing, 25_000, 1, "furnishing")
  near(m.cashNeeded, 94_000, 1, "cash needed")
  near(m.loanAmount, 240_000, 1, "loan amount")
})

test("the equity line covers the cash, so none of the owner's own money is in it", () => {
  const m = analyzeDeal(home(), market(), inputs(), comps(228), measured, 500_000)
  near(m.helocDraw, 94_000, 1, "drawn from the line")
  near(m.ownCash, 0, 0.01, "own cash")
  assert.equal(m.cashOnCash, null, "cash-on-cash is undefined with no own cash in")
  // Interest-only at 8.5%
  near(m.helocAnnual, 94_000 * 0.085, 1, "equity line interest")
})

test("max offer is the highest price that still clears every goal", () => {
  const mk = market()
  const inp = inputs()
  const offer = maxOffer(home(), mk, inp, comps(228), measured, 500_000)
  assert.ok(offer !== null, "an offer should exist")
  const at = analyzeDeal(home(), mk, inp, comps(228), measured, 500_000, offer!)
  assert.equal(at.meetsGoals, true, "the deal clears at the max offer")
  const above = analyzeDeal(home(), mk, inp, comps(228), measured, 500_000, offer! + 5_000)
  assert.equal(above.meetsGoals, false, "and fails just above it")
})

test("goals cannot be cleared on an occupancy nobody measured", () => {
  const unmeasured = { market: null, own: null, bookedAhead: null, listings: 0, historyDays: 0 }
  const m = analyzeDeal(home({ price: 120_000 }), market(), inputs(), comps(400), unmeasured, 500_000)
  assert.ok(m.cashFlow! > 0, "this one is profitable on the numbers")
  assert.equal(m.meetsGoals, false, "but it must not claim to clear the goals")
  assert.ok(
    m.goalNotes.some((n) => /measured occupancy/i.test(n)),
    "and it should say why",
  )
})

test("occupancy prefers measured data in order, and a constant only as a last resort", () => {
  const h = home()
  const mk = market()
  const inp = inputs()
  const pick = (occ: Parameters<typeof analyzeDeal>[4]) => analyzeDeal(h, mk, inp, comps(228), occ, 0)

  const all = { market: 0.6, own: 0.4, bookedAhead: 0.3, listings: 5, historyDays: 30 }
  assert.equal(pick(all).occupancySource, "market", "measured competitors win")
  near(pick(all).occupancy, 0.6, 0.001)

  const noMarket = { ...all, market: null }
  assert.equal(pick(noMarket).occupancySource, "own", "then the owner's own houses")

  const onlyAhead = { ...all, market: null, own: null }
  assert.equal(pick(onlyAhead).occupancySource, "bookedAhead", "then the measured floor")
  near(pick(onlyAhead).occupancy, 0.3, 0.001)

  const nothing = { market: null, own: null, bookedAhead: null, listings: 0, historyDays: 0 }
  assert.equal(pick(nothing).occupancySource, "fallback", "and only then a constant")
  near(pick(nothing).occupancy, 0.5, 0.001)

  // An override the owner typed beats every measurement
  const overridden = analyzeDeal(h, { ...mk, occupancyPct: 45 }, inp, comps(228), all, 0)
  assert.equal(overridden.occupancySource, "override")
  near(overridden.occupancy, 0.45, 0.001)
})

test("the buy box filters on price, beds, baths, type and distance", () => {
  const mk = market({ buyBox: { ...DEFAULT_BUY_BOX } })
  assert.equal(inBuyBox(home(), mk), true, "a 3/2 house at 300k in town")
  assert.equal(inBuyBox(home({ price: 199_999 }), mk), false, "below the floor")
  assert.equal(inBuyBox(home({ price: 600_001 }), mk), false, "above the ceiling")
  assert.equal(inBuyBox(home({ beds: 2 }), mk), false, "too few bedrooms")
  assert.equal(inBuyBox(home({ baths: 1 }), mk), false, "too few bathrooms")
  assert.equal(inBuyBox(home({ propertyType: "Condo/Co-op" }), mk), false, "wrong type")
  assert.equal(inBuyBox(home({ latitude: 30.5 }), mk), false, "outside the radius")
})

test("the sale pays depreciation recapture and capital gains before it pays you", () => {
  const m = analyzeDeal(home(), market(), inputs(), comps(228), measured, 500_000)
  const p = project(home(), market(), inputs(), m)!
  assert.ok(p.accumulatedDepreciation > 0, "ten years of deductions were taken")

  // Every deduction taken is recaptured at sale, so long as there is gain to
  // cover it, and the rest of the gain is a capital gain.
  near(p.recaptureTax, Math.min(p.accumulatedDepreciation, p.gainOnSale) * 0.25, 1, "recapture at 25%")
  near(
    p.capitalGainsTax,
    Math.max(0, p.gainOnSale - Math.min(p.accumulatedDepreciation, p.gainOnSale)) * 0.15,
    1,
    "capital gains at 15%",
  )
  assert.ok(p.saleTax > 0, "a sale at a gain is not tax-free")

  // And the proceeds are what's left after the taxman, not before him
  const lastYear = p.years[p.years.length - 1]
  const amountRealized = lastYear.propertyValue * (1 - (DEFAULT_INPUTS.hold.sellingCostPct ?? 0) / 100)
  near(p.saleProceeds, amountRealized - lastYear.loanBalance - m.helocDraw - p.saleTax, 2, "net proceeds")
})

test("no gain means no tax on the sale", () => {
  // No appreciation and heavy selling costs, so what comes back is less than
  // the basis even after a decade of depreciation has lowered it.
  const flat = inputs({ hold: { ...DEFAULT_INPUTS.hold, appreciationPct: 0, sellingCostPct: 60 } })
  const m = analyzeDeal(home(), market(), flat, comps(228), measured, 500_000)
  const p = project(home(), market(), flat, m)!
  assert.ok(p.gainOnSale < 0, "sold at a loss after costs")
  assert.equal(p.recaptureTax, 0, "nothing to recapture")
  assert.equal(p.capitalGainsTax, 0, "and no gain to tax")
})

test("the ten-year projection carries year one's cash flow and returns no IRR without own cash", () => {
  const m = analyzeDeal(home(), market(), inputs(), comps(228), measured, 500_000)
  const p = project(home(), market(), inputs(), m)
  assert.ok(p !== null)
  assert.equal(p!.years.length, 10, "ten years")
  near(p!.years[0].cashFlow, m.cashFlow!, 1, "year one matches the deal")
  assert.equal(p!.irr, null, "no own cash in, so there is no return on it to measure")
  assert.ok(p!.years[9].revenue > p!.years[0].revenue, "revenue grows with rent growth")
})
