// Market Analysis: the owner's editable assumptions and the deal math. Pure
// functions only, so the page recalculates instantly as inputs change and the
// server can validate what gets saved.
//
// Costs that differ by area (utilities, insurance, taxes, cleaning) live on
// each market. The equity line, purchase loan, and goals are shared, because
// there's one line of credit funding whichever deal comes next.

export const PROPERTY_TYPES = {
  house: { label: "Single-family", redfin: "Single Family Residential" },
  condo: { label: "Condo", redfin: "Condo/Co-op" },
  townhouse: { label: "Townhouse", redfin: "Townhouse" },
} as const
export type PropertyTypeKey = keyof typeof PROPERTY_TYPES

export interface EquitySource {
  label: string
  address: string
  homeValue: number | null
  mortgageBalance: number | null
}

export interface BuyBox {
  minPrice: number | null
  maxPrice: number | null
  minBeds: number | null
  minBaths: number | null
  propertyTypes: PropertyTypeKey[]
  poolRequired: boolean
  maxDaysOnMarket: number | null
}

export interface MarketExpenses {
  cleaningCostPerTurn: number | null
  utilitiesMonthly: number | null
  insuranceAnnual: number | null
  otherMonthly: number | null
  propertyTaxPct: number | null
  suppliesMaintenancePct: number | null
  capexReservePct: number | null
  managementPct: number | null
}

// Whether a city or county actually allows short-term rentals. A house that
// can't legally be rented nightly is worth nothing as a candidate, however
// well the numbers read, so this rides alongside the money.
export type StrLegality = "allowed" | "permit" | "restricted" | "banned" | "unknown"

export interface StrRules {
  status: StrLegality
  note: string
  sourceUrl: string
  checkedOn: string | null
}

export const STR_LEGALITY: Record<StrLegality, { label: string; blurb: string }> = {
  allowed: { label: "Allowed", blurb: "Nightly rentals are permitted here." },
  permit: { label: "Permit needed", blurb: "Allowed, but you must register or license first." },
  restricted: { label: "Restricted", blurb: "Limits apply \u2014 zones, caps, or minimum stays." },
  banned: { label: "Not allowed", blurb: "Nightly rentals are prohibited. Do not buy here to short-term rent." },
  unknown: { label: "Not checked", blurb: "Nobody has confirmed the rules for this market yet." },
}

export const DEFAULT_STR_RULES: StrRules = { status: "unknown", note: "", sourceUrl: "", checkedOn: null }

export interface MarketSettings {
  id: string
  label: string
  state: string | null
  county: string | null
  centerLat: number
  centerLng: number
  radiusMiles: number
  active: boolean
  buyBox: BuyBox
  expenses: MarketExpenses
  // Per-market overrides; blank means estimate from the data
  occupancyPct: number | null
  nightlyOverride: number | null
  strRules: StrRules
}

export interface MarketAnalysisInputs {
  markets: MarketSettings[]
  heloc: {
    equitySources: EquitySource[]
    maxCltvPct: number | null
    alreadyDrawn: number | null
    limitOverride: number | null
    ratePct: number | null
    interestOnly: boolean
    repayYears: number | null
    useForCashNeeded: boolean
  }
  loan: {
    downPaymentPct: number | null
    ratePct: number | null
    termYears: number | null
    closingCostPct: number | null
    furnishingCost: number | null
  }
  revenue: {
    avgStayNights: number | null
    guestServiceFeePct: number | null
    hostFeePct: number | null
    compRadiusMiles: number | null
  }
  goals: {
    targetCashOnCashPct: number | null
    minDscr: number | null
    targetAnnualCashFlow: number | null
  }
  // Holding period: what the deal looks like over years, after taxes
  hold: {
    years: number | null
    appreciationPct: number | null
    rentGrowthPct: number | null
    expenseGrowthPct: number | null
    sellingCostPct: number | null
    incomeTaxRatePct: number | null
    // Land can't be depreciated; the rest of the price can, over 27.5 years
    landSharePct: number | null
    furnishingLifeYears: number | null
    // The 2025 tax bill's 100% first-year write-off on short-life property
    bonusDepreciationPct: number | null
    // Share of the building a cost-segregation study reclassifies as
    // short-life property, which bonus depreciation can then write off
    costSegSharePct: number | null
  }
}

export const DEFAULT_BUY_BOX: BuyBox = {
  minPrice: 200000,
  maxPrice: 600000,
  minBeds: 3,
  minBaths: 2,
  propertyTypes: ["house"],
  poolRequired: false,
  maxDaysOnMarket: null,
}

export const DEFAULT_EXPENSES: MarketExpenses = {
  cleaningCostPerTurn: 120,
  utilitiesMonthly: 450,
  insuranceAnnual: 3600,
  otherMonthly: 250,
  propertyTaxPct: 1.8,
  suppliesMaintenancePct: 6,
  capexReservePct: 5,
  managementPct: 0,
}

// Coordinates, county, and state from OpenStreetMap's geocoder
export const DEFAULT_MARKETS: MarketSettings[] = [
  {
    id: "ocala-fl",
    label: "Ocala, FL",
    state: "Florida",
    county: "Marion County",
    centerLat: 29.1872,
    centerLng: -82.1401,
    radiusMiles: 12,
    active: true,
    buyBox: DEFAULT_BUY_BOX,
    expenses: DEFAULT_EXPENSES,
    occupancyPct: null,
    nightlyOverride: null,
    strRules: DEFAULT_STR_RULES,
  },
  {
    id: "berryville-ar",
    label: "Berryville, AR",
    state: "Arkansas",
    county: "Carroll County",
    centerLat: 36.3646,
    centerLng: -93.5673,
    radiusMiles: 15,
    active: true,
    buyBox: DEFAULT_BUY_BOX,
    expenses: DEFAULT_EXPENSES,
    occupancyPct: null,
    nightlyOverride: null,
    strRules: DEFAULT_STR_RULES,
  },
  {
    id: "pigeon-forge-tn",
    label: "Pigeon Forge, TN",
    state: "Tennessee",
    county: "Sevier County",
    centerLat: 35.7884,
    centerLng: -83.5543,
    radiusMiles: 10,
    active: true,
    buyBox: DEFAULT_BUY_BOX,
    expenses: DEFAULT_EXPENSES,
    occupancyPct: null,
    nightlyOverride: null,
    strRules: DEFAULT_STR_RULES,
  },
]

export const DEFAULT_INPUTS: MarketAnalysisInputs = {
  markets: DEFAULT_MARKETS,
  heloc: {
    equitySources: [],
    maxCltvPct: 80,
    alreadyDrawn: 0,
    limitOverride: null,
    ratePct: 8.5,
    interestOnly: true,
    repayYears: 10,
    useForCashNeeded: true,
  },
  loan: { downPaymentPct: 20, ratePct: 7.25, termYears: 30, closingCostPct: 3, furnishingCost: 25000 },
  revenue: { avgStayNights: 3, guestServiceFeePct: 14, hostFeePct: 3, compRadiusMiles: 5 },
  goals: { targetCashOnCashPct: 10, minDscr: 1.25, targetAnnualCashFlow: 0 },
  hold: {
    years: 10,
    appreciationPct: 3,
    rentGrowthPct: 3,
    expenseGrowthPct: 3,
    sellingCostPct: 8,
    incomeTaxRatePct: 24,
    landSharePct: 20,
    furnishingLifeYears: 5,
    bonusDepreciationPct: 100,
    costSegSharePct: 0,
  },
}

// Marion County, FL is the only county whose records this app can read
export function hasCountyRecords(market: MarketSettings): boolean {
  return market.state === "Florida" && (market.county ?? "").startsWith("Marion")
}

type Obj = Record<string, unknown>

function obj(v: unknown): Obj {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {}
}

// undefined = not sent (keep default); null or "" = cleared by the owner
function num(v: unknown, fallback: number | null, min = 0, max = 1e9): number | null {
  if (v === undefined) return fallback
  if (v === null || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback
}

function str(v: unknown, fallback: string, max = 160): string {
  return typeof v === "string" ? v.slice(0, max) : fallback
}

export function marketIdFromLabel(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)
  return slug || `market-${Math.random().toString(36).slice(2, 8)}`
}

function sanitizeBuyBox(raw: unknown, d: BuyBox): BuyBox {
  const b = obj(raw)
  const types = Array.isArray(b.propertyTypes)
    ? (b.propertyTypes as unknown[]).filter((t): t is PropertyTypeKey => typeof t === "string" && t in PROPERTY_TYPES)
    : d.propertyTypes
  return {
    minPrice: num(b.minPrice, d.minPrice),
    maxPrice: num(b.maxPrice, d.maxPrice),
    minBeds: num(b.minBeds, d.minBeds, 0, 20),
    minBaths: num(b.minBaths, d.minBaths, 0, 20),
    propertyTypes: types,
    poolRequired: bool(b.poolRequired, d.poolRequired),
    maxDaysOnMarket: num(b.maxDaysOnMarket, d.maxDaysOnMarket, 0, 5000),
  }
}

function sanitizeExpenses(raw: unknown, d: MarketExpenses): MarketExpenses {
  const e = obj(raw)
  return {
    cleaningCostPerTurn: num(e.cleaningCostPerTurn, d.cleaningCostPerTurn),
    utilitiesMonthly: num(e.utilitiesMonthly, d.utilitiesMonthly),
    insuranceAnnual: num(e.insuranceAnnual, d.insuranceAnnual),
    otherMonthly: num(e.otherMonthly, d.otherMonthly),
    propertyTaxPct: num(e.propertyTaxPct, d.propertyTaxPct, 0, 10),
    suppliesMaintenancePct: num(e.suppliesMaintenancePct, d.suppliesMaintenancePct, 0, 100),
    capexReservePct: num(e.capexReservePct, d.capexReservePct, 0, 100),
    managementPct: num(e.managementPct, d.managementPct, 0, 100),
  }
}

function sanitizeMarket(raw: unknown, fallback: MarketSettings): MarketSettings {
  const m = obj(raw)
  const label = str(m.label, fallback.label, 60)
  return {
    id: str(m.id, fallback.id, 60) || marketIdFromLabel(label),
    label,
    state: m.state === null ? null : str(m.state, fallback.state ?? "", 60) || null,
    county: m.county === null ? null : str(m.county, fallback.county ?? "", 60) || null,
    centerLat: num(m.centerLat, fallback.centerLat, -90, 90) ?? fallback.centerLat,
    centerLng: num(m.centerLng, fallback.centerLng, -180, 180) ?? fallback.centerLng,
    radiusMiles: num(m.radiusMiles, fallback.radiusMiles, 1, 40) ?? fallback.radiusMiles,
    active: bool(m.active, fallback.active),
    buyBox: sanitizeBuyBox(m.buyBox, fallback.buyBox),
    expenses: sanitizeExpenses(m.expenses, fallback.expenses),
    occupancyPct: num(m.occupancyPct, fallback.occupancyPct, 0, 100),
    nightlyOverride: num(m.nightlyOverride, fallback.nightlyOverride, 0, 100000),
    strRules: sanitizeStrRules(m.strRules, fallback.strRules ?? DEFAULT_STR_RULES),
  }
}

function sanitizeStrRules(raw: unknown, fallback: StrRules): StrRules {
  const r = obj(raw)
  const status = str(r.status, fallback.status, 20)
  return {
    status: (status in STR_LEGALITY ? status : fallback.status) as StrLegality,
    note: str(r.note, fallback.note, 400),
    sourceUrl: str(r.sourceUrl, fallback.sourceUrl, 400),
    checkedOn: r.checkedOn === null ? null : str(r.checkedOn, fallback.checkedOn ?? "", 10) || null,
  }
}

const BLANK_MARKET: MarketSettings = {
  id: "",
  label: "New market",
  state: null,
  county: null,
  centerLat: DEFAULT_MARKETS[0].centerLat,
  centerLng: DEFAULT_MARKETS[0].centerLng,
  radiusMiles: 12,
  active: true,
  buyBox: DEFAULT_BUY_BOX,
  expenses: DEFAULT_EXPENSES,
  occupancyPct: null,
  nightlyOverride: null,
  strRules: DEFAULT_STR_RULES,
}

export function sanitizeInputs(raw: unknown, defaults: MarketAnalysisInputs = DEFAULT_INPUTS): MarketAnalysisInputs {
  const r = obj(raw)
  const heloc = obj(r.heloc)
  const loan = obj(r.loan)
  const rev = obj(r.revenue)
  const goals = obj(r.goals)
  const hold = obj(r.hold)
  const d = defaults

  let markets: MarketSettings[]
  if (Array.isArray(r.markets)) {
    markets = (r.markets as unknown[]).slice(0, 12).map((m, i) => sanitizeMarket(m, d.markets[i] ?? BLANK_MARKET))
  } else if (r.area) {
    // Saved before markets existed: fold the single area into the first market
    const area = obj(r.area)
    const label = str(area.label, d.markets[0].label, 60)
    markets = [
      {
        ...d.markets[0],
        id: marketIdFromLabel(label),
        label,
        centerLat: num(area.centerLat, d.markets[0].centerLat, -90, 90) ?? d.markets[0].centerLat,
        centerLng: num(area.centerLng, d.markets[0].centerLng, -180, 180) ?? d.markets[0].centerLng,
        radiusMiles: num(area.radiusMiles, d.markets[0].radiusMiles, 1, 40) ?? d.markets[0].radiusMiles,
        buyBox: sanitizeBuyBox(r.buyBox, d.markets[0].buyBox),
        expenses: sanitizeExpenses(r.expenses, d.markets[0].expenses),
        occupancyPct: num(obj(r.revenue).occupancyPct, null, 0, 100),
        nightlyOverride: num(obj(r.revenue).nightlyOverride, null, 0, 100000),
      },
      ...d.markets.slice(1),
    ]
  } else {
    markets = d.markets
  }

  const sources = Array.isArray(heloc.equitySources)
    ? (heloc.equitySources as unknown[]).slice(0, 20).map((s) => {
        const o = obj(s)
        return {
          label: str(o.label, ""),
          address: str(o.address, ""),
          homeValue: num(o.homeValue, null),
          mortgageBalance: num(o.mortgageBalance, null),
        }
      })
    : d.heloc.equitySources

  return {
    markets,
    heloc: {
      equitySources: sources,
      maxCltvPct: num(heloc.maxCltvPct, d.heloc.maxCltvPct, 0, 100),
      alreadyDrawn: num(heloc.alreadyDrawn, d.heloc.alreadyDrawn),
      limitOverride: num(heloc.limitOverride, d.heloc.limitOverride),
      ratePct: num(heloc.ratePct, d.heloc.ratePct, 0, 30),
      interestOnly: bool(heloc.interestOnly, d.heloc.interestOnly),
      repayYears: num(heloc.repayYears, d.heloc.repayYears, 1, 40),
      useForCashNeeded: bool(heloc.useForCashNeeded, d.heloc.useForCashNeeded),
    },
    loan: {
      downPaymentPct: num(loan.downPaymentPct, d.loan.downPaymentPct, 0, 100),
      ratePct: num(loan.ratePct, d.loan.ratePct, 0, 30),
      termYears: num(loan.termYears, d.loan.termYears, 1, 40),
      closingCostPct: num(loan.closingCostPct, d.loan.closingCostPct, 0, 20),
      furnishingCost: num(loan.furnishingCost, d.loan.furnishingCost),
    },
    revenue: {
      avgStayNights: num(rev.avgStayNights, d.revenue.avgStayNights, 1, 60),
      guestServiceFeePct: num(rev.guestServiceFeePct, d.revenue.guestServiceFeePct, 0, 50),
      hostFeePct: num(rev.hostFeePct, d.revenue.hostFeePct, 0, 50),
      compRadiusMiles: num(rev.compRadiusMiles, d.revenue.compRadiusMiles, 0.5, 40),
    },
    goals: {
      targetCashOnCashPct: num(goals.targetCashOnCashPct, d.goals.targetCashOnCashPct, -100, 1000),
      minDscr: num(goals.minDscr, d.goals.minDscr, 0, 10),
      targetAnnualCashFlow: num(goals.targetAnnualCashFlow, d.goals.targetAnnualCashFlow, -1e6, 1e7),
    },
    hold: {
      years: num(hold.years, d.hold.years, 1, 40),
      appreciationPct: num(hold.appreciationPct, d.hold.appreciationPct, -20, 30),
      rentGrowthPct: num(hold.rentGrowthPct, d.hold.rentGrowthPct, -20, 30),
      expenseGrowthPct: num(hold.expenseGrowthPct, d.hold.expenseGrowthPct, -20, 30),
      sellingCostPct: num(hold.sellingCostPct, d.hold.sellingCostPct, 0, 20),
      incomeTaxRatePct: num(hold.incomeTaxRatePct, d.hold.incomeTaxRatePct, 0, 60),
      landSharePct: num(hold.landSharePct, d.hold.landSharePct, 0, 90),
      furnishingLifeYears: num(hold.furnishingLifeYears, d.hold.furnishingLifeYears, 1, 30),
      bonusDepreciationPct: num(hold.bonusDepreciationPct, d.hold.bonusDepreciationPct, 0, 100),
      costSegSharePct: num(hold.costSegSharePct, d.hold.costSegSharePct, 0, 60),
    },
  }
}

// ── Data shapes sent to the page ─────────────────────────────────────────

export interface CountyRecord {
  parcel: string
  prcUrl: string
  owner: string | null
  justValue: number | null
  assessedValue: number | null
  exemptions: number | null
  taxableValue: number | null
  zoning: string | null
  yearBuilt: number | null
  bedrooms: number | null
  livingArea: number | null
  pool: boolean
  acres: number | null
  millageGroup: string | null
  valueHistory: { year: number; just: number; assessed: number; taxable: number }[]
  sales: { date: string; price: number; instrument: string; qualified: boolean }[]
}

export interface ForSaleHome {
  id: string
  marketId: string
  url: string
  address: string
  city: string | null
  zip: string | null
  propertyType: string | null
  price: number
  previousPrice: number | null
  priceChangedOn: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  lotSqft: number | null
  yearBuilt: number | null
  daysOnMarket: number | null
  hoaMonthly: number | null
  latitude: number
  longitude: number
  firstSeenOn: string
  county: CountyRecord | null
  countyError: string | null
}

export interface StrSample {
  marketId: string
  bedrooms: number
  lat: number
  lng: number
  nightly: number
}

// ── Math ─────────────────────────────────────────────────────────────────

const n0 = (v: number | null | undefined) => v ?? 0
const pct = (v: number | null | undefined) => n0(v) / 100

export function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad
  const dLng = (bLng - aLng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(h))
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function monthlyPayment(principal: number, ratePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0
  const r = ratePct / 100 / 12
  const count = years * 12
  return r === 0 ? principal / count : (principal * r) / (1 - (1 + r) ** -count)
}

export function helocCapacity(h: MarketAnalysisInputs["heloc"]): { gross: number; available: number } {
  const gross =
    h.limitOverride !== null
      ? h.limitOverride
      : h.equitySources.reduce(
          (sum, s) => sum + Math.max(0, n0(s.homeValue) * pct(h.maxCltvPct) - n0(s.mortgageBalance)),
          0,
        )
  return { gross, available: Math.max(0, gross - n0(h.alreadyDrawn)) }
}

export function propertyTypeKey(redfinType: string | null): PropertyTypeKey | null {
  for (const [key, t] of Object.entries(PROPERTY_TYPES)) if (t.redfin === redfinType) return key as PropertyTypeKey
  return null
}

export function inBuyBox(home: ForSaleHome, market: MarketSettings): boolean {
  const b = market.buyBox
  if (b.minPrice !== null && home.price < b.minPrice) return false
  if (b.maxPrice !== null && home.price > b.maxPrice) return false
  if (b.minBeds !== null && (home.beds ?? 0) < b.minBeds) return false
  if (b.minBaths !== null && (home.baths ?? 0) < b.minBaths) return false
  if (b.maxDaysOnMarket !== null && (home.daysOnMarket ?? 0) > b.maxDaysOnMarket) return false
  const type = propertyTypeKey(home.propertyType)
  if (b.propertyTypes.length && (!type || !b.propertyTypes.includes(type))) return false
  if (b.poolRequired && home.county?.pool !== true) return false
  return milesBetween(market.centerLat, market.centerLng, home.latitude, home.longitude) <= market.radiusMiles
}

// Airbnb prices near the home with the same bedroom count (widening to ±1
// bedroom when there are fewer than 3). Airbnb's guest total includes its
// service fee, which the host never sees, so that comes off.
function percentile(values: number[], p: number): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const idx = (s.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return s[lo] + (s[hi] - s[lo]) * (idx - lo)
}

// How much to trust a nightly estimate: enough comps, and do they agree?
// Spread is the middle half's width as a share of the median.
export type Confidence = "strong" | "fair" | "weak" | "none"

export function confidenceFrom(compCount: number, spread: number | null): Confidence {
  if (compCount < 3 || spread === null) return "none"
  if (compCount >= 8 && spread <= 0.35) return "strong"
  if (compCount >= 5 && spread <= 0.6) return "fair"
  return "weak"
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  strong: "Strong — plenty of similar homes, prices agree",
  fair: "Fair — a workable set, prices vary",
  weak: "Weak — few comps or prices scattered; treat as a guess",
  none: "None — not enough similar homes nearby",
}

// Every comp is priced as a two-night stay, and Airbnb's displayed total for
// a dated stay includes the cleaning fee. Dividing that total by two spreads
// a whole cleaning fee across two nights, while the cost side of the model
// spreads the owner's cleaning cost across an average stay of three. Left
// alone, the same fee is counted as revenue at one rate and as cost at
// another, and the gap flatters every house.
//
// The guest's cleaning fee isn't visible in the total on its own, so the
// owner's own cost per turn stands in for it — in a short-term rental the
// two are usually within a few dollars, and it is a number the owner set
// himself rather than one invented here.
export const COMP_SAMPLE_NIGHTS = 2

export function cleaningSpreadPerNight(inputs: MarketAnalysisInputs, market: MarketSettings): number {
  const avgStay = Math.max(1, inputs.revenue.avgStayNights ?? COMP_SAMPLE_NIGHTS)
  const fee = Math.max(0, market.expenses.cleaningCostPerTurn ?? 0)
  return fee * (1 / COMP_SAMPLE_NIGHTS - 1 / avgStay)
}

export function estimateNightly(
  home: ForSaleHome,
  samples: StrSample[],
  inputs: MarketAnalysisInputs,
  market: MarketSettings,
) {
  const beds = Math.min(6, Math.max(2, Math.round(home.beds ?? 3)))
  const radius = inputs.revenue.compRadiusMiles ?? 5
  const near = samples.filter((s) => milesBetween(home.latitude, home.longitude, s.lat, s.lng) <= radius)
  let comps = near.filter((s) => s.bedrooms === beds)
  if (comps.length < 3) comps = near.filter((s) => Math.abs(s.bedrooms - beds) <= 1)
  const nightlies = comps.map((s) => s.nightly)
  // The comps themselves, nearest first. BNBCalc shows its working; an
  // estimate you can't inspect is one you can't argue with.
  const compList = comps
    .map((c) => ({
      bedrooms: c.bedrooms,
      nightly: c.nightly,
      miles: milesBetween(home.latitude, home.longitude, c.lat, c.lng),
      lat: c.lat,
      lng: c.lng,
    }))
    .sort((a, b) => a.miles - b.miles)
  const guestNightly = comps.length >= 3 ? median(nightlies) : null
  const p25 = percentile(nightlies, 0.25)
  const p75 = percentile(nightlies, 0.75)
  const spread = guestNightly && p25 !== null && p75 !== null ? (p75 - p25) / guestNightly : null
  // Airbnb's service fee never reaches the host, and the cleaning fee has to
  // be re-spread from the two nights it was sampled over to the stay length
  // the costs assume. A floor keeps a large fee in a cheap market from
  // driving the rate to nothing.
  const feeSpread = cleaningSpreadPerNight(inputs, market)
  const toHost = (v: number | null) =>
    v === null ? null : Math.max(v * 0.5, v / (1 + pct(inputs.revenue.guestServiceFeePct)) - feeSpread)
  return {
    guestNightly,
    hostNightly: toHost(guestNightly),
    hostNightlyLow: toHost(p25),
    hostNightlyHigh: toHost(p75),
    compCount: comps.length,
    comps: compList,
    spread,
    confidence: confidenceFrom(comps.length, spread),
  }
}

export type CompRow = ReturnType<typeof estimateNightly>["comps"][number]

export interface DealMetrics {
  price: number
  nightly: number | null
  nightlySource: "override" | "market" | "none"
  airbnbComps: number
  confidence: Confidence
  // Width of the comps' middle half, as a share of the median
  compSpread: number | null
  // Active Airbnbs within a mile: proof there is demand, and a saturation read
  strWithinMile: number
  // An active Airbnb sits on top of this parcel, so it is probably already
  // running as one. A hint, not a fact \u2014 Airbnb blurs listing locations.
  likelyExistingStr: boolean
  // Revenue if comps' cheaper / middle / pricier rates hold
  revenueRange: { low: number; base: number; high: number } | null
  occupancy: number
  occupancySource: "override" | "market" | "own" | "fallback"
  nightsBooked: number
  revenue: number | null
  expenses: {
    hostFees: number
    cleaning: number
    utilities: number
    insurance: number
    other: number
    hoa: number
    propertyTax: number
    suppliesMaintenance: number
    capexReserve: number
    management: number
    total: number
  } | null
  noi: number | null
  downPayment: number
  closingCosts: number
  furnishing: number
  cashNeeded: number
  helocDraw: number
  ownCash: number
  loanAmount: number
  mortgageAnnual: number
  helocAnnual: number
  debtServiceAnnual: number
  cashFlow: number | null
  capRate: number | null
  cashOnCash: number | null
  // What every borrowed dollar earns, against what the equity line costs
  returnOnBorrowed: number | null
  borrowedSpread: number | null
  dscr: number | null
  breakEvenOccupancy: number | null
  meetsGoals: boolean
  goalNotes: string[]
}

// Month-to-month shape of a market, plus how far competitors' asking prices
// sit above what actually books. Both come from the daily collection.
export interface MarketSignalsLite {
  months: { month: number; rateIndex: number; occupancyIndex: number }[]
  achievedRatio: number | null
}

export interface OccupancyEstimates {
  market: number | null
  own: number | null
  signals?: MarketSignalsLite | null
}

// What the daily calendar snapshots say about one market
export interface MarketOccupancy {
  bookedAhead: number | null
  realized: number | null
  listings: number
  historyDays: number
}

// Which occupancy a market uses, in order: the owner's own entry (handled in
// analyzeDeal), that market's own competitors once there's enough history,
// the Ocala comps from Price Evaluation, then the owner's own houses.
export function resolveOccupancy(
  market: MarketSettings,
  byMarket: Record<string, MarketOccupancy>,
  ownOccupancy: number | null,
  priceEvalOccupancy: number | null,
): OccupancyEstimates & { bookedAhead: number | null; listings: number; historyDays: number } {
  const m = byMarket[market.id]
  return {
    market: m?.realized ?? (hasCountyRecords(market) ? priceEvalOccupancy : null),
    own: ownOccupancy,
    bookedAhead: m?.bookedAhead ?? null,
    listings: m?.listings ?? 0,
    historyDays: m?.historyDays ?? 0,
  }
}

const DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

// Spreads the year across months when the market's seasonal shape is known.
// The indexes average about 1, so the owner's occupancy and rate still set
// the level — seasonality only moves revenue between months.
function seasonalRevenue(nightly: number, occupancy: number, signals?: MarketSignalsLite | null): number {
  const months = signals?.months ?? []
  if (months.length < 6) return nightly * 365 * occupancy
  let revenue = 0
  for (let m = 0; m < 12; m++) {
    const s = months.find((x) => x.month === m)
    const rate = nightly * (s?.rateIndex ?? 1)
    const occ = Math.min(0.98, occupancy * (s?.occupancyIndex ?? 1))
    revenue += rate * occ * DAYS_IN_MONTH[m]
  }
  return revenue
}

export function analyzeDeal(
  home: ForSaleHome,
  market: MarketSettings,
  inputs: MarketAnalysisInputs,
  samples: StrSample[],
  occupancy: OccupancyEstimates,
  helocAvailable: number,
  priceOverride?: number,
): DealMetrics {
  const { revenue: rv, loan, heloc, goals } = inputs
  const ex = market.expenses
  const price = priceOverride ?? home.price
  const est = estimateNightly(home, samples, inputs, market)
  // Every sample is one distinct Airbnb, so these counts are listings.
  const strWithinMile = samples.filter(
    (s) => milesBetween(home.latitude, home.longitude, s.lat, s.lng) <= 1,
  ).length
  // Airbnb blurs a listing's pin by up to ~150m, so anything this close with
  // the same bedroom count is plausibly this very house already operating.
  const homeBeds = Math.round(home.beds ?? 0)
  const likelyExistingStr =
    homeBeds > 0 &&
    samples.some(
      (s) =>
        s.bedrooms === homeBeds &&
        milesBetween(home.latitude, home.longitude, s.lat, s.lng) <= 0.12,
    )
  // Competitors' asking prices sit above what actually books, so once that
  // gap has been measured in this market, trim the estimate by it.
  const achievedRatio = occupancy.signals?.achievedRatio ?? 1
  const marketNightly = est.hostNightly === null ? null : est.hostNightly * achievedRatio
  const nightly = market.nightlyOverride ?? marketNightly
  const occ =
    market.occupancyPct !== null ? market.occupancyPct / 100 : occupancy.market ?? occupancy.own ?? 0.5
  const nightsBooked = 365 * occ
  const avgStay = Math.max(1, rv.avgStayNights ?? 3)

  const downPayment = price * pct(loan.downPaymentPct)
  const closingCosts = price * pct(loan.closingCostPct)
  const furnishing = n0(loan.furnishingCost)
  const cashNeeded = downPayment + closingCosts + furnishing
  const helocDraw = heloc.useForCashNeeded ? Math.min(helocAvailable, cashNeeded) : 0
  const ownCash = cashNeeded - helocDraw
  const loanAmount = price - downPayment
  const mortgageAnnual = monthlyPayment(loanAmount, n0(loan.ratePct), n0(loan.termYears) || 30) * 12
  const helocAnnual = heloc.interestOnly
    ? helocDraw * pct(heloc.ratePct)
    : monthlyPayment(helocDraw, n0(heloc.ratePct), heloc.repayYears ?? 10) * 12
  const debtServiceAnnual = mortgageAnnual + helocAnnual

  const fixed = {
    utilities: n0(ex.utilitiesMonthly) * 12,
    insurance: n0(ex.insuranceAnnual),
    other: n0(ex.otherMonthly) * 12,
    hoa: n0(home.hoaMonthly) * 12,
    propertyTax: price * pct(ex.propertyTaxPct),
  }
  const variablePct =
    pct(rv.hostFeePct) + pct(ex.suppliesMaintenancePct) + pct(ex.capexReservePct) + pct(ex.managementPct)

  let revenue: number | null = null
  let expenses: DealMetrics["expenses"] = null
  let noi: number | null = null
  let breakEvenOccupancy: number | null = null
  if (nightly !== null) {
    revenue = seasonalRevenue(nightly, occ, occupancy.signals)
    const cleaning = (nightsBooked / avgStay) * n0(ex.cleaningCostPerTurn)
    const parts = {
      hostFees: revenue * pct(rv.hostFeePct),
      cleaning,
      ...fixed,
      suppliesMaintenance: revenue * pct(ex.suppliesMaintenancePct),
      capexReserve: revenue * pct(ex.capexReservePct),
      management: revenue * pct(ex.managementPct),
    }
    const total = Object.values(parts).reduce((a, b) => a + b, 0)
    expenses = { ...parts, total }
    noi = revenue - total
    const netPerNight = nightly * (1 - variablePct) - n0(ex.cleaningCostPerTurn) / avgStay
    const fixedTotal = Object.values(fixed).reduce((a, b) => a + b, 0) + debtServiceAnnual
    breakEvenOccupancy = netPerNight > 0 ? fixedTotal / (netPerNight * 365) : null
  }

  const revenueRange =
    revenue === null || market.nightlyOverride !== null || est.hostNightlyLow === null || est.hostNightlyHigh === null
      ? null
      : {
          low: seasonalRevenue(est.hostNightlyLow * achievedRatio, occ, occupancy.signals),
          base: revenue,
          high: seasonalRevenue(est.hostNightlyHigh * achievedRatio, occ, occupancy.signals),
        }

  const cashFlow = noi === null ? null : noi - debtServiceAnnual
  const capRate = noi === null ? null : noi / price
  const cashOnCash = cashFlow !== null && ownCash > 0 ? cashFlow / ownCash : null
  const dscr = noi !== null && debtServiceAnnual > 0 ? noi / debtServiceAnnual : null
  // What the borrowed money earns before its own interest, so it can be
  // compared with the equity line's rate
  const returnOnBorrowed =
    cashFlow !== null && helocDraw > 0 ? (cashFlow + helocAnnual) / helocDraw : null
  const borrowedSpread = returnOnBorrowed === null ? null : returnOnBorrowed - pct(heloc.ratePct)

  const goalNotes: string[] = []
  let meetsGoals = cashFlow !== null && cashFlow >= n0(goals.targetAnnualCashFlow)
  if (cashFlow === null) goalNotes.push("No Airbnb price estimate nearby")
  else if (cashFlow < n0(goals.targetAnnualCashFlow)) {
    goalNotes.push(goals.targetAnnualCashFlow ? `Cash flow below $${Math.round(n0(goals.targetAnnualCashFlow)).toLocaleString()}` : "Loses money after debt payments")
  }
  if (cashOnCash !== null && goals.targetCashOnCashPct !== null && cashOnCash * 100 < goals.targetCashOnCashPct) {
    meetsGoals = false
    goalNotes.push(`Cash-on-cash below ${goals.targetCashOnCashPct}%`)
  }
  if (dscr !== null && goals.minDscr !== null && dscr < goals.minDscr) {
    meetsGoals = false
    goalNotes.push(`Debt coverage below ${goals.minDscr}`)
  }
  if (borrowedSpread !== null && borrowedSpread < 0) {
    meetsGoals = false
    goalNotes.push("Earns less than the equity line costs")
  }
  if (breakEvenOccupancy !== null && breakEvenOccupancy > occ) goalNotes.push("Break-even occupancy is above the estimate")

  // Occupancy moves every figure here more than anything else does. When it
  // is the plain default — nobody's override, no measured competitors, no
  // history of the owner's own — a house passing every goal is telling you
  // about the guess, not about the house. It still gets its numbers; it does
  // not get to say it clears the bar.
  const occupancyMeasured =
    market.occupancyPct !== null || occupancy.market !== null || occupancy.own !== null
  if (!occupancyMeasured && meetsGoals) {
    meetsGoals = false
    goalNotes.push("No measured occupancy for this market yet — set one to judge this deal")
  }

  return {
    price,
    nightly,
    nightlySource: market.nightlyOverride !== null ? "override" : est.hostNightly !== null ? "market" : "none",
    airbnbComps: est.compCount,
    confidence: market.nightlyOverride !== null ? "strong" : est.confidence,
    compSpread: est.spread,
    strWithinMile,
    likelyExistingStr,
    revenueRange,
    occupancy: occ,
    occupancySource:
      market.occupancyPct !== null
        ? "override"
        : occupancy.market !== null
          ? "market"
          : occupancy.own !== null
            ? "own"
            : "fallback",
    nightsBooked,
    revenue,
    expenses,
    noi,
    downPayment,
    closingCosts,
    furnishing,
    cashNeeded,
    helocDraw,
    ownCash,
    loanAmount,
    mortgageAnnual,
    helocAnnual,
    debtServiceAnnual,
    cashFlow,
    capRate,
    cashOnCash,
    returnOnBorrowed,
    borrowedSpread,
    dscr,
    breakEvenOccupancy,
    meetsGoals,
    goalNotes,
  }
}

// The highest price that still meets every goal. Returns to the dollar by
// halving the range: raising the price only ever hurts the numbers, so there
// is exactly one crossover point.
export function maxOffer(
  home: ForSaleHome,
  market: MarketSettings,
  inputs: MarketAnalysisInputs,
  samples: StrSample[],
  occupancy: OccupancyEstimates,
  helocAvailable: number,
): number | null {
  const meets = (price: number) =>
    analyzeDeal(home, market, inputs, samples, occupancy, helocAvailable, price).meetsGoals
  let low = 10000
  if (!meets(low)) return null
  let high = Math.max(home.price * 2, 100000)
  if (meets(high)) return Math.round(high)
  for (let i = 0; i < 40 && high - low > 500; i++) {
    const mid = (low + high) / 2
    if (meets(mid)) low = mid
    else high = mid
  }
  return Math.round(low / 1000) * 1000
}

// ── Holding period ───────────────────────────────────────────────────────

export interface ProjectionYear {
  year: number
  revenue: number
  operatingExpenses: number
  noi: number
  interest: number
  principal: number
  helocInterest: number
  cashFlow: number
  depreciation: number
  taxableIncome: number
  tax: number
  afterTaxCashFlow: number
  loanBalance: number
  propertyValue: number
  equity: number
}

export interface Projection {
  years: ProjectionYear[]
  totalCashFlow: number
  totalAfterTaxCashFlow: number
  saleProceeds: number
  totalProfit: number
  equityAtExit: number
  cashInvested: number
  // Annualised return on the owner's own cash; null when the equity line
  // covers everything, since there's no cash of their own to measure
  irr: number | null
}

function irrOf(cashFlows: number[]): number | null {
  const npv = (rate: number) => cashFlows.reduce((sum, cf, i) => sum + cf / (1 + rate) ** i, 0)
  if (cashFlows[0] >= 0) return null
  let low = -0.9
  let high = 5
  if (npv(low) < 0 || npv(high) > 0) return null
  for (let i = 0; i < 80; i++) {
    const mid = (low + high) / 2
    if (npv(mid) > 0) low = mid
    else high = mid
  }
  return (low + high) / 2
}

// Year-by-year cash flow, loan paydown, appreciation, depreciation and tax,
// then the sale. Growth rates and the tax rate are assumptions the owner
// sets; this is an estimate, not tax advice.
export function project(
  home: ForSaleHome,
  market: MarketSettings,
  inputs: MarketAnalysisInputs,
  m: DealMetrics,
): Projection | null {
  if (m.revenue === null || m.expenses === null) return null
  const h = inputs.hold
  const years = Math.max(1, Math.round(n0(h.years) || 10))
  const appreciation = pct(h.appreciationPct)
  const rentGrowth = pct(h.rentGrowthPct)
  const expenseGrowth = pct(h.expenseGrowthPct)
  const taxRate = pct(h.incomeTaxRatePct)
  const buildingShare = 1 - pct(h.landSharePct)
  const buildingBasis = m.price * buildingShare
  // A cost-segregation study reclassifies part of the building (appliances,
  // carpet, fixtures, land improvements) as short-life property. That part,
  // plus the furnishings, is what bonus depreciation can write off at once.
  const shortLifeBasis = buildingBasis * pct(h.costSegSharePct)
  const buildingDepreciation = (buildingBasis - shortLifeBasis) / 27.5
  const furnishingLife = Math.max(1, n0(h.furnishingLifeYears) || 5)
  const shortLife = m.furnishing + shortLifeBasis
  const bonusShare = pct(h.bonusDepreciationPct)
  const bonusYearOne = shortLife * bonusShare
  const furnishingDepreciation = (shortLife * (1 - bonusShare)) / furnishingLife

  const monthlyRate = n0(inputs.loan.ratePct) / 100 / 12
  const payment = monthlyPayment(m.loanAmount, n0(inputs.loan.ratePct), n0(inputs.loan.termYears) || 30)
  let balance = m.loanAmount
  let value = m.price
  let carryForwardLoss = 0

  const rows: ProjectionYear[] = []
  for (let year = 1; year <= years; year++) {
    const revenue = m.revenue * (1 + rentGrowth) ** (year - 1)
    // Costs tied to revenue move with it; fixed costs move with inflation
    const variable = m.expenses.hostFees + m.expenses.suppliesMaintenance + m.expenses.capexReserve + m.expenses.management
    const fixed = m.expenses.total - variable
    const operatingExpenses =
      variable * (1 + rentGrowth) ** (year - 1) + fixed * (1 + expenseGrowth) ** (year - 1)
    const noi = revenue - operatingExpenses

    let interest = 0
    let principal = 0
    for (let month = 0; month < 12 && balance > 0; month++) {
      const monthInterest = balance * monthlyRate
      const monthPrincipal = Math.min(balance, payment - monthInterest)
      interest += monthInterest
      principal += monthPrincipal
      balance -= monthPrincipal
    }
    const cashFlow = noi - interest - principal - m.helocAnnual
    const depreciation =
      buildingDepreciation +
      (year <= furnishingLife ? furnishingDepreciation : 0) +
      (year === 1 ? bonusYearOne : 0)
    const taxableRaw = noi - interest - m.helocAnnual - depreciation - carryForwardLoss
    const taxableIncome = Math.max(0, taxableRaw)
    carryForwardLoss = taxableRaw < 0 ? -taxableRaw : 0
    const tax = taxableIncome * taxRate

    value *= 1 + appreciation
    rows.push({
      year,
      revenue,
      operatingExpenses,
      noi,
      interest,
      principal,
      helocInterest: m.helocAnnual,
      cashFlow,
      depreciation,
      taxableIncome,
      tax,
      afterTaxCashFlow: cashFlow - tax,
      loanBalance: balance,
      propertyValue: value,
      equity: value - balance,
    })
  }

  const last = rows[rows.length - 1]
  // Selling costs come out, the mortgage is repaid, and the equity line is
  // paid back from the proceeds
  const saleProceeds = last.propertyValue * (1 - pct(h.sellingCostPct)) - last.loanBalance - m.helocDraw
  const totalCashFlow = rows.reduce((sum, r) => sum + r.cashFlow, 0)
  const totalAfterTaxCashFlow = rows.reduce((sum, r) => sum + r.afterTaxCashFlow, 0)
  const cashInvested = m.ownCash
  const flows = [-cashInvested, ...rows.map((r, i) => r.afterTaxCashFlow + (i === rows.length - 1 ? saleProceeds : 0))]

  return {
    years: rows,
    totalCashFlow,
    totalAfterTaxCashFlow,
    saleProceeds,
    totalProfit: totalAfterTaxCashFlow + saleProceeds - cashInvested,
    equityAtExit: last.equity,
    cashInvested,
    irr: cashInvested > 0 ? irrOf(flows) : null,
  }
}

export interface Scenario {
  occupancyPct: number
  label: string
  cashFlow: number | null
  cashOnCash: number | null
  returnOnBorrowed: number | null
  dscr: number | null
  maxOffer: number | null
  meetsGoals: boolean
}

// The same deal at different occupancy levels: the number nobody can know in
// advance, and the one that decides whether borrowing to buy makes sense.
export function occupancyScenarios(
  home: ForSaleHome,
  market: MarketSettings,
  inputs: MarketAnalysisInputs,
  samples: StrSample[],
  occupancy: OccupancyEstimates,
  helocAvailable: number,
  baseOccupancy: number,
  priceOverride?: number,
): Scenario[] {
  const base = Math.round(baseOccupancy * 100)
  const levels = [
    { occupancyPct: Math.max(10, base - 10), label: "Worse than expected" },
    { occupancyPct: base, label: "Your estimate" },
    { occupancyPct: Math.min(95, base + 10), label: "Better than expected" },
    { occupancyPct: Math.min(95, base + 20), label: "Strong year" },
  ]
  const seen = new Set<number>()
  return levels
    .filter((l) => !seen.has(l.occupancyPct) && seen.add(l.occupancyPct))
    .map(({ occupancyPct, label }) => {
      const scenarioMarket = { ...market, occupancyPct }
      const m = analyzeDeal(home, scenarioMarket, inputs, samples, occupancy, helocAvailable, priceOverride)
      return {
        occupancyPct,
        label,
        cashFlow: m.cashFlow,
        cashOnCash: m.cashOnCash,
        returnOnBorrowed: m.returnOnBorrowed,
        dscr: m.dscr,
        maxOffer: maxOffer(home, scenarioMarket, inputs, samples, occupancy, helocAvailable),
        meetsGoals: m.meetsGoals,
      }
    })
}
