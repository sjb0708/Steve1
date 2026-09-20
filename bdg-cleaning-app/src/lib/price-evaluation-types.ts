// Shape of the Price Evaluation report, shared by the API and the page.
// All prices are guest-paid per night: the Airbnb total for the stay
// (including cleaning and Airbnb service fees, before taxes) divided by nights.

export interface StayWindowStat {
  checkin: string
  checkout: string
  kind: "weekend" | "weekday"
  compCount: number
  p25: number | null
  median: number | null
  p75: number | null
  yourPrice: number | null
  // false = your home is already booked or blocked for these nights
  yourAvailable: boolean | null
  // share of similar homes already booked for these nights
  marketBookedPct: number | null
  suggested: number | null
  suggestionNote: string
}

export interface CompRow {
  listingId: string
  name: string | null
  bedrooms: number | null
  beds: number | null
  baths: number | null
  rating: number | null
  reviews: number | null
  distanceMiles: number
  weekendNightly: number | null
  weekdayNightly: number | null
  bookedAhead30: number | null
  occupancy30: number | null
  estMonthlyRevenue: number | null
}

export interface RevenueRange {
  low: number
  mid: number
  high: number
}

export interface PriceEvaluation {
  propertyId: string
  propertyName: string
  ownListingId: string | null
  hasData: boolean
  lastCapturedOn: string | null
  firstCapturedOn: string | null
  historyDays: number
  // What counted as a similar home for this property
  criteria: {
    minBedrooms: number
    minGuests: number | null
    pool: boolean | null
    radiusMiles: number | null
  } | null
  market: {
    compCount: number
    weekendMedian: number | null
    weekdayMedian: number | null
    blendedMedian: number | null
    bookedAhead30: number | null
    occupancy30: number | null
    revpar: number | null
    estAnnualRevenue: RevenueRange | null
    medianRating: number | null
  } | null
  you: {
    weekendAvg: number | null
    weekdayAvg: number | null
    blended: number | null
    bookedAhead30: number | null
    occupancy30: number | null
    revpar: number | null
    estAnnualRevenue: number | null
    rating: number | null
    reviews: number | null
    // share of similar homes priced below you (0–1)
    pricePercentile: number | null
  } | null
  windows: StayWindowStat[]
  comps: CompRow[]
}
