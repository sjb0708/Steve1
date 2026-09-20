"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Header } from "@/components/layout/Header"
import { Card, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import {
  PROPERTY_TYPES, DEFAULT_BUY_BOX, DEFAULT_EXPENSES, CONFIDENCE_LABEL, analyzeDeal, maxOffer, helocCapacity,
  inBuyBox, hasCountyRecords, marketIdFromLabel, resolveOccupancy, occupancyScenarios, project,
  DEFAULT_STR_RULES, STR_LEGALITY, estimateNightly, milesBetween, type StrLegality, type CompRow,
  type MarketAnalysisInputs, type MarketSettings, type ForSaleHome, type StrSample, type DealMetrics,
  type PropertyTypeKey, type CountyRecord, type MarketOccupancy, type Confidence,
  type Projection,
} from "@/lib/deal-analysis"
import type { MarketSignals } from "@/lib/seasonality"
import {
  RefreshCw, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, ExternalLink,
  X, Plus, Trash2, Save, RotateCcw, Landmark, Search, TrendingDown, Info, MapPin, SlidersHorizontal,
} from "lucide-react"
import dynamic from "next/dynamic"
import type { MapHome } from "./AreaMap"

// Leaflet reaches for window as it loads, so the map is client-only
const AreaMap = dynamic(() => import("./AreaMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-400">
      Loading map…
    </div>
  ),
})

type Run = { status: "RUNNING" | "COMPLETE" | "FAILED"; error: string | null; startedAt: string; finishedAt: string | null }
type Data = {
  inputs: MarketAnalysisInputs
  defaults: MarketAnalysisInputs
  homes: ForSaleHome[]
  strSamples: StrSample[]
  strCapturedOn: string | null
  listingsSeenByMarket: Record<string, string>
  today: string
  occupancyByMarket: Record<string, MarketOccupancy>
  signalsByMarket: Record<string, MarketSignals>
  ownOccupancy: number | null
  priceEvalOccupancy: number | null
  lastRun: Run | null
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// Deliberately not green: green on this page means "clears your goals", and
// a green confidence badge on a losing house reads as a recommendation.
const CONFIDENCE_STYLE: Record<Confidence, string> = {
  strong: "bg-slate-200 text-slate-700",
  fair: "bg-blue-100 text-blue-800",
  weak: "bg-amber-100 text-amber-800",
  none: "bg-slate-100 text-slate-600",
}
type Place = { label: string; displayName: string; latitude: number; longitude: number; county: string | null; state: string | null }
type SortKey = "cashFlow" | "cashOnCash" | "capRate" | "maxOffer" | "price" | "newest"

const money = (v: number | null | undefined) =>
  v == null ? "—" : `${v < 0 ? "-" : ""}$${Math.abs(Math.round(v)).toLocaleString()}`
const pct = (v: number | null | undefined, digits = 1) => (v == null ? "—" : `${(v * 100).toFixed(digits)}%`)

const OCCUPANCY_SOURCE: Record<DealMetrics["occupancySource"], string> = {
  override: "your input",
  market: "similar Airbnbs, last 30 days",
  own: "your houses, both channels",
  bookedAhead: "competitors' next 30 days — a floor, not a year",
  fallback: "a plain 50% default",
}

// ── Input controls ───────────────────────────────────────────────────────

function NumberField({
  label, value, onChange, prefix, suffix, hint, step = "any", placeholder = "—",
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  prefix?: string
  suffix?: string
  hint?: string
  step?: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1 relative flex items-center">
        {prefix && <span className="absolute left-3 text-sm text-slate-400 pointer-events-none">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className={`w-full py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${prefix ? "pl-7" : "pl-3"} ${suffix ? "pr-14" : "pr-8"}`}
        />
        {suffix && <span className="absolute right-8 text-xs text-slate-400 pointer-events-none">{suffix}</span>}
        {value !== null && (
          <button type="button" onClick={() => onChange(null)} title="Clear"
            className="absolute right-2 p-0.5 text-slate-300 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {hint && <span className="block text-[11px] text-slate-400 mt-1 leading-snug">{hint}</span>}
    </label>
  )
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-slate-600">{label}</p>
        {hint && <p className="text-[11px] text-slate-400 leading-snug">{hint}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-blue-600" : "bg-slate-200"}`}>
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  )
}

function Section({ title, subtitle, children, defaultOpen = false, show = true }: {
  title: string
  subtitle?: string
  children: React.ReactNode
  defaultOpen?: boolean
  show?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (!show) return null
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-2 py-3 text-left">
        <span>
          <span className="block text-sm font-semibold text-slate-900">{title}</span>
          {subtitle && <span className="block text-[11px] text-slate-400">{subtitle}</span>}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>
      {open && <div className="pb-4 space-y-3">{children}</div>}
    </div>
  )
}

// ── Results pieces ───────────────────────────────────────────────────────

// Written for someone who has never underwritten a rental: every number on
// this page, where it came from, and how much to trust it.
function HowItWorks({ market, occupancy, signals, inputs }: {
  market: MarketSettings
  occupancy: { market: number | null; own: number | null; bookedAhead: number | null; listings: number; historyDays: number }
  signals?: MarketSignals
  inputs: MarketAnalysisInputs
}) {
  const [open, setOpen] = useState(false)
  const occupancyLine =
    market.occupancyPct !== null
      ? `${market.occupancyPct}% — the number you typed in for ${market.label}.`
      : occupancy.market !== null
        ? `${pct(occupancy.market, 0)} — measured from ${occupancy.listings} competitors' calendars in ${market.label} over the last 30 days.`
        : occupancy.own !== null
          ? `${pct(occupancy.own, 0)} — your own two houses' booked nights over the last 12 months, because ${market.label} doesn't have 30 days of history yet${occupancy.bookedAhead !== null ? ` (its competitors are ${pct(occupancy.bookedAhead, 0)} booked for next month, day ${occupancy.historyDays} of 30)` : ""}.`
          : "50% — a plain default. Your own houses can't stand in for it: Airbnb's calendar feed only starts the day it was connected, so their history is VRBO-only before July 2026 and too short after it. Type the number you believe for this market, or wait for its competitors' calendars to reach 30 days."

  return (
    <Card className="border-blue-100 bg-blue-50/40">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="font-semibold text-slate-900">Where these numbers come from</span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
          <p>
            <b>Nightly rate.</b> The middle price of similar Airbnbs near each house — same bedroom count, within{" "}
            {inputs.revenue.compRadiusMiles ?? 5} miles — with Airbnb&apos;s guest fee taken off, so it&apos;s what would
            reach you. These are prices hosts are <b>asking</b> for upcoming dates, not prices guests paid. Asking is
            usually higher than what books, so read it as the optimistic end
            {signals?.achievedRatio != null
              ? `. This market's measured gap is ${pct(1 - signals.achievedRatio, 0)}, and estimates are already trimmed by it.`
              : " until enough sampled nights pass for the app to measure the gap."}
          </p>
          <p>
            <b>Occupancy.</b> {occupancyLine} This is the number that moves everything, so if you know the market better
            than the data does, type your own in Settings.
          </p>
          <p>
            <b>Profit per year.</b> What&apos;s left after every bill and payment: cleaning, utilities, insurance,
            property tax at your purchase price, HOA, supplies and repairs, a capital reserve, Airbnb&apos;s host fee,
            the mortgage payment, and interest on the equity line.
          </p>
          <p>
            <b>Not counted in it:</b> income tax (that&apos;s in the 10-year view when you open a row), and the one-off
            cash to buy — down payment, closing costs and furnishing — which shows when you open a home.
          </p>
          <p className="rounded-xl bg-white/70 p-3 text-slate-600">
            <b>How much to trust it.</b> The arithmetic is exact; the inputs are estimates. Three things decide whether a
            house works: occupancy, the nightly rate, and what you pay. Open any row to see the same deal at higher and
            lower occupancy — if it only works on the best row, it&apos;s a bet, not a deal.
          </p>
          <ul className="space-y-2 list-disc pl-5 text-slate-600">
            <li><b>Max offer</b> is the highest price where the deal still clears every goal you set: cash-on-cash, loan coverage, minimum cash flow, and earning more than the equity line costs.</li>
            <li>Homes for sale come from Redfin&apos;s listing download every morning. Some local MLS listings aren&apos;t included, so check Zillow before ruling an area out.</li>
            <li><b>Confidence</b> reflects how many Airbnb comps there were and how closely they agreed — treat &quot;weak&quot; as a guess.</li>
            <li>You get a notification the day a new listing or price drop meets your goals, so you don&apos;t have to watch this page.</li>
            <li>Taxes, exemptions, zoning, pool and past sales come from the Marion County, FL appraiser, so they only fill in for Ocala. Check zoning, HOA rules and short-term rental rules before making an offer anywhere.</li>
          </ul>
        </div>
      )}
    </Card>
  )
}

// ── Is it even legal? ────────────────────────────────────────────────────
// Every other tool on the market prices the deal and stays silent on whether
// the city allows nightly rentals at all. A banned market makes every other
// number on this page meaningless, so it leads.

const LEGALITY_STYLE: Record<StrLegality, { pill: string; banner: string }> = {
  allowed: { pill: "bg-emerald-100 text-emerald-800", banner: "bg-emerald-50 border-emerald-200 text-emerald-900" },
  permit: { pill: "bg-blue-100 text-blue-800", banner: "bg-blue-50 border-blue-200 text-blue-900" },
  restricted: { pill: "bg-amber-100 text-amber-800", banner: "bg-amber-50 border-amber-200 text-amber-900" },
  banned: { pill: "bg-red-100 text-red-800", banner: "bg-red-50 border-red-200 text-red-900" },
  unknown: { pill: "bg-slate-100 text-slate-600", banner: "bg-slate-50 border-slate-200 text-slate-700" },
}

function LegalityPill({ status }: { status: StrLegality }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${LEGALITY_STYLE[status].pill}`}>
      {STR_LEGALITY[status].label}
    </span>
  )
}

function LegalityBanner({ market }: { market: MarketSettings }) {
  const r = market.strRules
  const style = LEGALITY_STYLE[r.status]
  const meta = STR_LEGALITY[r.status]
  const Icon = r.status === "banned" ? AlertCircle : r.status === "allowed" ? CheckCircle2 : Info
  return (
    <div className={`rounded-2xl border p-4 flex items-start gap-3 ${style.banner}`}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {market.label}: {meta.label.toLowerCase() === "not checked" ? "short-term rental rules not checked" : meta.label}
        </p>
        <p className="text-xs mt-0.5">{r.note || meta.blurb}</p>
        {r.status === "unknown" && (
          <p className="text-xs mt-1 opacity-80">
            Look up the city and county ordinance before you make an offer. A house you can&apos;t rent nightly
            is worth nothing as a rental, whatever the numbers below say.
          </p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          {r.sourceUrl && (
            <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-medium underline inline-flex items-center gap-1">
              The rule <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {r.checkedOn && <span className="text-[11px] opacity-70">Checked {r.checkedOn}</span>}
        </div>
      </div>
    </div>
  )
}

// ── The answer, before the evidence ──────────────────────────────────────
// Everything below this is working out. This is the finding: whether there
// is anything worth buying today, and where. It is the only part of the page
// you have to read.

function Verdict({ rows, currentId, onPick }: {
  rows: ScoreRow[]
  currentId: string
  onPick: (id: string) => void
}) {
  if (!rows.length) return null
  const ranked = [...rows].sort(
    (a, b) => b.clearing - a.clearing || (b.bestCashFlow ?? -Infinity) - (a.bestCashFlow ?? -Infinity),
  )
  const top = ranked[0]
  const good = top.clearing > 0
  const elsewhere = top.market.id !== currentId

  return (
    <div className={`rounded-2xl border p-5 ${good ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={`text-lg font-bold ${good ? "text-emerald-900" : "text-slate-900"}`}>
            {good
              ? `Buy in ${top.market.label} — ${top.clearing} home${top.clearing === 1 ? "" : "s"} clear${top.clearing === 1 ? "s" : ""} your goals`
              : "Nothing on the market clears your goals today"}
          </p>
          <p className={`text-sm mt-1 ${good ? "text-emerald-800" : "text-slate-600"}`}>
            {good && top.bestHome ? (
              <>
                Best of them is <b>{top.bestHome.address}</b>, asking {money(top.bestHome.price)} —{" "}
                <b>{money(top.bestCashFlow)}/yr</b> in your pocket after every bill and payment.
              </>
            ) : top.bestHome ? (
              <>
                Closest is <b>{top.bestHome.address}</b> in {top.market.label}, asking {money(top.bestHome.price)} —{" "}
                {money(top.bestCashFlow)}/yr at that price. Open it to see the offer that would make it work.
              </>
            ) : (
              <>No homes in your buy box yet. Widen the area or price range, then run an update.</>
            )}
          </p>
        </div>
        {elsewhere && (
          <Button size="sm" variant={good ? "primary" : "outline"} onClick={() => onPick(top.market.id)}>
            Go to {top.market.label}
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Which market, before which house ─────────────────────────────────────
// AirDNA scores markets, Mashvisor ranks neighborhoods. Neither knows your
// equity line or your goals, so this ranks your own markets on the only
// thing that matters: how many homes in each actually clear your bar.

export type ScoreRow = {
  market: MarketSettings
  forSale: number
  inBox: number
  clearing: number
  bestCashFlow: number | null
  bestHome: { address: string; price: number; id: string } | null
  medianNightly: number | null
  listings: number
  occupancy: number | null
  occupancyIsOwn: boolean
  historyDays: number
}

function MarketScorecard({ rows, currentId, onPick }: {
  rows: ScoreRow[]
  currentId: string
  onPick: (id: string) => void
}) {
  if (rows.length < 2) return null
  const ranked = [...rows].sort(
    (a, b) => b.clearing - a.clearing || (b.bestCashFlow ?? -Infinity) - (a.bestCashFlow ?? -Infinity),
  )
  const anyClearing = ranked.some((r) => r.clearing > 0)
  // Occupancy was a column until every row of it read the same; it only earns
  // a line when the markets actually differ.
  const occupancies = ranked.map((r) => (r.occupancy === null ? null : Math.round(r.occupancy * 100)))
  const sameOccupancy = occupancies.every((o) => o === occupancies[0])
  const occupancyNote =
    occupancies[0] === null
      ? null
      : sameOccupancy
        ? `All priced at ${occupancies[0]}% occupancy — ${ranked[0].occupancyIsOwn ? "your own houses' last 12 months, until each market has 30 days of its own history" : `${ranked[0].historyDays} days of local history`}.`
        : ranked.map((r) => `${r.market.label} ${r.occupancy === null ? "—" : pct(r.occupancy, 0)}`).join(" · ")
  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-4">
        <CardTitle>Which market first</CardTitle>
        <p className="text-xs text-slate-500 sm:mt-0.5 sm:text-right">
          Your markets side by side, ranked by how many homes clear your goals. Tap one to work it.
        </p>
      </CardHeader>
      <div className="px-4 pb-4 sm:hidden space-y-2">
        {ranked.map((r, i) => (
          <button key={r.market.id} type="button" onClick={() => onPick(r.market.id)}
            className={`w-full text-left p-3 rounded-xl border ${r.market.id === currentId ? "border-blue-200 bg-blue-50/60" : "border-slate-100"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-900">
                {r.market.label}
                {i === 0 && anyClearing && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">best</span>
                )}
              </span>
              <LegalityPill status={r.market.strRules.status} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <span>
                <span className="block text-[11px] text-slate-400">Clears goals</span>
                <b className={r.clearing > 0 ? "text-emerald-700" : "text-slate-400"}>{r.clearing}</b>
                <span className="text-xs text-slate-400"> / {r.inBox}</span>
              </span>
              <span>
                <span className="block text-[11px] text-slate-400">Best profit</span>
                <b className={(r.bestCashFlow ?? 0) < 0 ? "text-red-600" : "text-slate-800"}>
                  {r.bestCashFlow === null ? "\u2014" : money(r.bestCashFlow)}
                </b>
              </span>
              <span>
                <span className="block text-[11px] text-slate-400">Nightly</span>
                <b className="text-slate-800">{r.medianNightly === null ? "\u2014" : money(r.medianNightly)}</b>
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="hidden sm:block px-4 pb-4 overflow-x-auto max-w-full">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
              <th className="py-2 pr-3 font-medium">Market</th>
              <th className="py-2 pr-3 font-medium">Legal to rent</th>
              <th className="py-2 pr-3 font-medium" title="Homes for sale that fit your buy box">Fits your box</th>
              <th className="py-2 pr-3 font-medium" title="Of those, how many clear every goal you set">Clears goals</th>
              <th className="py-2 pr-3 font-medium">Best profit / yr</th>
              <th className="py-2 font-medium" title="Middle nightly price of the Airbnbs we track there">Typical nightly</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => (
              <tr
                key={r.market.id}
                onClick={() => onPick(r.market.id)}
                className={`border-t border-slate-100 cursor-pointer hover:bg-slate-50 ${
                  r.market.id === currentId ? "bg-blue-50/60" : ""
                }`}
              >
                <td className="py-2.5 pr-3">
                  <span className="font-medium text-slate-900">{r.market.label}</span>
                  {i === 0 && anyClearing && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      best
                    </span>
                  )}
                  {!r.market.active && <span className="ml-2 text-xs text-slate-400">paused</span>}
                </td>
                <td className="py-2.5 pr-3"><LegalityPill status={r.market.strRules.status} /></td>
                <td className="py-2.5 pr-3 text-slate-700">
                  {r.inBox}
                  <span className="text-xs text-slate-400"> / {r.forSale}</span>
                </td>
                <td className={`py-2.5 pr-3 font-semibold ${r.clearing > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                  {r.clearing}
                </td>
                <td className={`py-2.5 pr-3 ${(r.bestCashFlow ?? 0) < 0 ? "text-red-600" : "text-slate-800"}`}>
                  {r.bestCashFlow === null ? "\u2014" : money(r.bestCashFlow)}
                </td>
                <td className="py-2.5 text-slate-700">
                  {r.medianNightly === null ? "\u2014" : money(r.medianNightly)}
                  <span className="block text-xs text-slate-400">{r.listings || 0} Airbnbs tracked</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 pb-4 -mt-2">
        {occupancyNote && <p className="text-xs text-slate-400">{occupancyNote}</p>}
        {!anyClearing && (
          <p className="text-xs text-slate-500 mt-2">
            No market has a home clearing your goals right now. That is the honest answer, not a bug — at
            today&apos;s rates the asking prices don&apos;t support the rents. Watch the Max offer column for what
            each house would have to sell for.
          </p>
        )}
      </div>
    </Card>
  )
}

// ── Estimate any address ─────────────────────────────────────────────────
// The front door every one of these tools has and we didn't: type an address,
// get the number. AirDNA calls it Rentalizer. All the math already existed —
// this just lets you point it at a house our nightly scan never pulled.

type Estimate = {
  address: string
  approximate: boolean
  market: MarketSettings
  milesFromCenter: number
  outsideRadius: boolean
  m: DealMetrics
  offer: number | null
  comps: CompRow[]
  compRadius: number
}

function Estimator({ inputs, markets, samplesFor, occupancyFor, helocAvailable }: {
  inputs: MarketAnalysisInputs
  markets: MarketSettings[]
  samplesFor: (marketId: string) => StrSample[]
  occupancyFor: (market: MarketSettings) => Parameters<typeof analyzeDeal>[4]
  helocAvailable: number
}) {
  const [query, setQuery] = useState("")
  const [price, setPrice] = useState<number | null>(null)
  const [beds, setBeds] = useState<number | null>(3)
  const [baths, setBaths] = useState<number | null>(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Estimate | null>(null)
  const [showComps, setShowComps] = useState(false)

  async function run() {
    if (!query.trim()) return
    if (price === null || price <= 0) { setError("Put in what the house costs \u2014 the profit depends on it."); return }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      type Place = { displayName: string; latitude: number; longitude: number }
      const lookup = async (q: string): Promise<Place | null> => {
        const res = await fetch(`/api/market-analysis/geocode?q=${encodeURIComponent(q)}`)
        const d = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(d.error ?? "Couldn't find that address.")
        return ((d.places ?? [])[0] as Place | undefined) ?? null
      }

      let place = await lookup(query)
      // The free OpenStreetMap geocoder often has no record of a rural street
      // address. The town alone still puts us in the right comp set, which is
      // what the revenue estimate actually rests on — so fall back to it
      // and say plainly that the pin is the town, not the house.
      let approximate = false
      if (!place) {
        const town = query.split(",").slice(1).join(",").trim()
        if (town) {
          place = await lookup(town)
          approximate = place !== null
        }
      }
      if (!place) {
        setError("No match for that address, even on the town. Check the spelling, or add the city and state.")
        return
      }

      // Whichever saved market this address falls in, else the nearest one:
      // its costs, occupancy and rules are the best guide we have.
      const ranked = markets
        .map((mk) => ({ mk, miles: milesBetween(place.latitude, place.longitude, mk.centerLat, mk.centerLng) }))
        .sort((a, b) => a.miles - b.miles)
      const nearest = ranked[0]
      if (!nearest) { setError("Add a market first \u2014 the estimate needs one for costs and occupancy."); return }

      const home: ForSaleHome = {
        id: "estimate", marketId: nearest.mk.id, url: "", address: place.displayName,
        city: null, zip: null, propertyType: null, price,
        previousPrice: null, priceChangedOn: null, beds, baths, sqft: null, lotSqft: null,
        yearBuilt: null, daysOnMarket: null, hoaMonthly: null,
        latitude: place.latitude, longitude: place.longitude,
        firstSeenOn: "", county: null, countyError: null,
      }
      const samples = samplesFor(nearest.mk.id)
      const occ = occupancyFor(nearest.mk)
      const est = estimateNightly(home, samples, inputs, nearest.mk)
      setResult({
        address: place.displayName,
        approximate,
        market: nearest.mk,
        milesFromCenter: nearest.miles,
        outsideRadius: nearest.miles > nearest.mk.radiusMiles,
        m: analyzeDeal(home, nearest.mk, inputs, samples, occ, helocAvailable),
        offer: maxOffer(home, nearest.mk, inputs, samples, occ, helocAvailable),
        comps: est.comps,
        compRadius: inputs.revenue.compRadiusMiles ?? 5,
      })
      setShowComps(false)
    } catch {
      setError("That lookup failed. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const r = result
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estimate any address</CardTitle>
        <p className="text-xs text-slate-500 mt-0.5">
          A house you found yourself, anywhere. Same math as the table below.
        </p>
      </CardHeader>
      <div className="px-4 pb-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), run())}
            placeholder="1234 Maple St, Pigeon Forge, TN"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <Button onClick={run} loading={busy}>{!busy && <Search className="w-4 h-4" />} Estimate</Button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <NumberField label="Asking price" prefix="$" step="1000" value={price} onChange={setPrice} placeholder="Required" />
          <NumberField label="Bedrooms" step="1" value={beds} onChange={setBeds} />
          <NumberField label="Bathrooms" step="0.5" value={baths} onChange={setBaths} />
        </div>

        {error && (
          <p className="text-xs text-red-600 flex items-start gap-1">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
          </p>
        )}

        {r && (
          <div className="pt-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{r.address}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Priced with {r.market.label}&apos;s costs and occupancy — {r.milesFromCenter.toFixed(1)} miles from its centre.
                {" "}<LegalityPill status={r.market.strRules.status} />
              </p>
              {r.approximate && (
                <p className="text-xs text-amber-700 mt-1 flex items-start gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  That exact street address isn&apos;t in the free address database, so this is pinned to the town
                  centre instead. The nightly rate is still drawn from Airbnbs across the area, but anything that
                  depends on the precise spot is approximate.
                </p>
              )}
              {r.outsideRadius && (
                <p className="text-xs text-amber-700 mt-1 flex items-start gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  This is outside {r.market.label}&apos;s {r.market.radiusMiles}-mile area, so its costs and occupancy are
                  a rough stand-in. Add a market centred here for a real read.
                </p>
              )}
            </div>

            {r.m.nightly === null ? (
              <p className="text-sm text-slate-500">
                No nightly estimate: only {r.m.airbnbComps} comparable Airbnbs within {r.compRadius} miles, and three
                is the minimum. Widen the comp radius in the details, or this is simply somewhere nobody rents nightly.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Stat label="Nightly rate" value={money(r.m.nightly)} sub={`${r.m.airbnbComps} comps \u00b7 ${CONFIDENCE_LABEL[r.m.confidence]}`} />
                  <Stat label="Revenue / yr" value={money(r.m.revenue)} sub={`at ${pct(r.m.occupancy, 0)} occupancy`} />
                  <Stat label="Profit / yr" value={money(r.m.cashFlow)}
                    sub={r.m.cashFlow === null ? undefined : `${r.m.cashFlow < 0 ? "\u2212" : "+"}${money(Math.abs(r.m.cashFlow) / 12)}/mo`} />
                  <Stat label="Max offer" value={r.offer === null ? "none works" : money(r.offer)}
                    sub={r.offer === null ? "no price clears your goals" : `vs. ${money(r.m.price)} asking`} />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${r.m.meetsGoals ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                    {r.m.meetsGoals ? "Clears your goals" : "Doesn't clear your goals"}
                  </span>
                  {r.m.goalNotes.map((n) => (
                    <span key={n} className="text-xs text-slate-500">{n}</span>
                  ))}
                </div>

                {r.comps.length > 0 && (
                  <div>
                    <button type="button" onClick={() => setShowComps((v) => !v)}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      {showComps ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showComps ? "Hide" : "Show"} the {r.comps.length} Airbnbs this is based on
                    </button>
                    {showComps && (
                      <table className="w-full text-xs mt-2">
                        <thead>
                          <tr className="text-left text-slate-500 border-b border-slate-100">
                            <th className="py-1 pr-3 font-medium">Distance</th>
                            <th className="py-1 pr-3 font-medium">Bedrooms</th>
                            <th className="py-1 font-medium">Asking / night</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.comps.slice(0, 20).map((c, i) => (
                            <tr key={i} className="border-t border-slate-50">
                              <td className="py-1 pr-3 text-slate-600">{c.miles.toFixed(1)} mi</td>
                              <td className="py-1 pr-3 text-slate-600">{c.bedrooms}</td>
                              <td className="py-1 text-slate-800">{money(c.nightly)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      These are what hosts are <b>asking</b> for upcoming nights, before Airbnb&apos;s guest fee.
                      The estimate uses the middle one, trimmed by the gap between asking and what actually books.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-1 truncate">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

function Line({ label, value, strong, negative }: { label: string; value: string; strong?: boolean; negative?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 text-sm py-1 ${strong ? "font-semibold text-slate-900 border-t border-slate-100 mt-1 pt-2" : "text-slate-600"}`}>
      <span>{label}</span>
      <span className={negative ? "text-red-600" : strong ? "text-slate-900" : "text-slate-800"}>{value}</span>
    </div>
  )
}

function CountyPanel({ home, market, onRefresh, refreshing }: { home: ForSaleHome; market: MarketSettings; onRefresh: () => void; refreshing: boolean }) {
  const c: CountyRecord | null = home.county
  const supported = hasCountyRecords(market)
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">County records</p>
        {supported && (
          <Button size="sm" variant="ghost" onClick={onRefresh} loading={refreshing}>
            {!refreshing && <Search className="w-3.5 h-3.5" />} {c ? "Refresh" : "Pull records"}
          </Button>
        )}
      </div>
      {!supported ? (
        <p className="text-sm text-slate-500">
          Taxes, sale history, and pool come from the Marion County, FL appraiser. {market.county ?? "This county"} isn&apos;t
          connected, so check its property appraiser site by hand.
        </p>
      ) : !c ? (
        <p className="text-sm text-slate-500">{home.countyError ?? "Not pulled yet. The daily scan pulls records for homes in your buy box."}</p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <Line label="Parcel" value={c.parcel || "—"} />
            <Line label="Zoning" value={c.zoning ?? "—"} />
            <Line label="County just value" value={money(c.justValue)} />
            <Line label="Taxable value" value={money(c.taxableValue)} />
            <Line label="Exemptions" value={money(c.exemptions)} />
            <Line label="Pool on record" value={c.pool ? "Yes" : "No"} />
            <Line label="Year built" value={c.yearBuilt ? String(c.yearBuilt) : "—"} />
            <Line label="Living area" value={c.livingArea ? `${c.livingArea.toLocaleString()} sq ft` : "—"} />
          </div>
          {(c.exemptions ?? 0) > 0 && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-2 flex gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              The seller has {money(c.exemptions)} in exemptions (likely homestead). Taxes reset to your purchase price, so
              the seller&apos;s current bill will be lower than yours.
            </p>
          )}
          {c.sales.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-slate-500"><th className="py-1 pr-3 font-medium">Sold</th><th className="py-1 pr-3 font-medium">Price</th><th className="py-1 pr-3 font-medium">Deed</th><th className="py-1 font-medium">Market sale</th></tr></thead>
                <tbody>
                  {c.sales.map((s, i) => (
                    <tr key={i} className="border-t border-slate-50">
                      <td className="py-1 pr-3 text-slate-700">{s.date}</td>
                      <td className="py-1 pr-3 text-slate-900">{money(s.price)}</td>
                      <td className="py-1 pr-3 text-slate-600">{s.instrument}</td>
                      <td className="py-1 text-slate-600">{s.qualified ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {c.valueHistory.length > 0 && (
            <p className="text-xs text-slate-500">
              County value history: {c.valueHistory.map((v) => `${v.year} ${money(v.just)}`).join(" · ")}
            </p>
          )}
          <a href={c.prcUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
            Full property record card <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  )
}

function ProjectionPanel({ p, inputs }: { p: Projection | null; inputs: MarketAnalysisInputs }) {
  if (!p) return null
  const shown = p.years.filter((y, i) => i < 3 || y.year === p.years.length)
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Over {p.years.length} years, after tax
      </p>
      <Line label="Cash flow, all years" value={money(p.totalCashFlow)} />
      <Line label="After tax" value={money(p.totalAfterTaxCashFlow)} />
      <Line label="Equity at sale" value={money(p.equityAtExit)} />
      <Line label="Proceeds after costs & payoff" value={money(p.saleProceeds)} />
      <Line label="Total profit" value={money(p.totalProfit)} strong negative={p.totalProfit < 0} />
      <Line
        label="Annual return on your cash"
        value={p.irr === null ? "No cash in — funded by the line" : pct(p.irr)}
      />
      <table className="w-full text-xs mt-2">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-1 pr-2 font-medium">Year</th>
            <th className="py-1 pr-2 font-medium">Cash flow</th>
            <th className="py-1 pr-2 font-medium">Tax</th>
            <th className="py-1 pr-2 font-medium">Loan left</th>
            <th className="py-1 font-medium">Equity</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((y) => (
            <tr key={y.year} className="border-t border-slate-100">
              <td className="py-1 pr-2 text-slate-700">{y.year}</td>
              <td className={`py-1 pr-2 ${y.cashFlow < 0 ? "text-red-600" : "text-slate-900"}`}>{money(y.cashFlow)}</td>
              <td className="py-1 pr-2 text-slate-600">{y.tax > 0 ? money(-y.tax) : "$0"}</td>
              <td className="py-1 pr-2 text-slate-600">{money(y.loanBalance)}</td>
              <td className="py-1 text-slate-900">{money(y.equity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-slate-400 mt-1">
        Assumes {inputs.hold.appreciationPct ?? 0}% appreciation and {inputs.hold.rentGrowthPct ?? 0}% rate growth a year.
        Depreciation often wipes out the tax bill early on. Change any of it in your inputs.
      </p>
    </div>
  )
}

function DealDetail({ home, inputs, market, samples, occupancy, helocAvailable, onRefreshCounty, refreshing }: {
  home: ForSaleHome
  inputs: MarketAnalysisInputs
  market: MarketSettings
  samples: StrSample[]
  occupancy: Parameters<typeof analyzeDeal>[4]
  helocAvailable: number
  onRefreshCounty: () => void
  refreshing: boolean
}) {
  // Null means "at the asking price". Type a number and every figure in this
  // panel is what that offer would buy you.
  const [offerPrice, setOfferPrice] = useState<number | null>(null)
  const price = offerPrice !== null && offerPrice > 0 ? offerPrice : home.price

  const m = useMemo(
    () => analyzeDeal(home, market, inputs, samples, occupancy, helocAvailable, price),
    [home, market, inputs, samples, occupancy, helocAvailable, price],
  )
  const offer = useMemo(
    () => maxOffer(home, market, inputs, samples, occupancy, helocAvailable),
    [home, market, inputs, samples, occupancy, helocAvailable],
  )
  const scenarios = useMemo(
    () => occupancyScenarios(home, market, inputs, samples, occupancy, helocAvailable, m.occupancy, price),
    [home, market, inputs, samples, occupancy, helocAvailable, m.occupancy, price],
  )
  const projection = useMemo(() => project(home, market, inputs, m), [home, market, inputs, m])

  const e = m.expenses
  return (
    <div className="grid gap-6 lg:grid-cols-3 p-4 bg-slate-50/60">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Yearly income &amp; costs</p>
        <Line label={`Nightly rate (${m.nightlySource === "override" ? "your override" : `${m.airbnbComps} nearby Airbnbs`})`} value={money(m.nightly)} />
        <Line label={`Occupancy (${OCCUPANCY_SOURCE[m.occupancySource]})`} value={pct(m.occupancy, 0)} />
        <Line label="Nights booked" value={Math.round(m.nightsBooked).toString()} />
        <Line label="Gross revenue" value={money(m.revenue)} strong />
        {m.revenueRange && (
          <p className="text-xs text-slate-500 mb-1">
            If comps&apos; cheaper or pricier rates hold: {money(m.revenueRange.low)} – {money(m.revenueRange.high)}
          </p>
        )}
        <p className="text-xs text-slate-500">
          Estimate confidence: <b className="text-slate-700">{m.confidence}</b> — {CONFIDENCE_LABEL[m.confidence]}
          {m.compSpread !== null && ` (middle half of comps spans ${pct(m.compSpread, 0)} of the median)`}
        </p>
        {e && (
          <>
            <Line label="Airbnb host fee" value={money(-e.hostFees)} />
            <Line label="Cleaning" value={money(-e.cleaning)} />
            <Line label="Utilities" value={money(-e.utilities)} />
            <Line label="Insurance" value={money(-e.insurance)} />
            <Line label="Property tax (at purchase price)" value={money(-e.propertyTax)} />
            {e.hoa > 0 && <Line label="HOA" value={money(-e.hoa)} />}
            <Line label="Other (pool, lawn, pest, software)" value={money(-e.other)} />
            <Line label="Supplies & maintenance" value={money(-e.suppliesMaintenance)} />
            <Line label="Capital reserve" value={money(-e.capexReserve)} />
            {e.management > 0 && <Line label="Management" value={money(-e.management)} />}
            <Line label="Net operating income" value={money(m.noi)} strong negative={(m.noi ?? 0) < 0} />
          </>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Financing</p>
        <Line label={`Down payment (${inputs.loan.downPaymentPct ?? 0}%)`} value={money(m.downPayment)} />
        <Line label="Closing costs" value={money(m.closingCosts)} />
        <Line label="Furnishing & setup" value={money(m.furnishing)} />
        <Line label="Cash needed" value={money(m.cashNeeded)} strong />
        <Line label="Drawn from equity line" value={money(m.helocDraw)} />
        <Line label="From your own cash" value={money(m.ownCash)} />
        <Line label="Mortgage amount" value={money(m.loanAmount)} />
        <Line label="Mortgage payments / yr" value={money(-m.mortgageAnnual)} />
        <Line label={`Equity line ${inputs.heloc.interestOnly ? "interest" : "payments"} / yr`} value={money(-m.helocAnnual)} />
        <Line label="Cash flow / yr" value={money(m.cashFlow)} strong negative={(m.cashFlow ?? 0) < 0} />
        <Line label="Cash flow / month" value={money(m.cashFlow === null ? null : m.cashFlow / 12)} />
        <Line label="Break-even occupancy" value={pct(m.breakEvenOccupancy, 0)} />
        {m.returnOnBorrowed !== null && (
          <div className={`mt-3 p-3 rounded-xl text-sm ${(m.borrowedSpread ?? 0) >= 0 ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}>
            <p className={`font-semibold ${(m.borrowedSpread ?? 0) >= 0 ? "text-emerald-900" : "text-red-900"}`}>
              Borrowed money earns {pct(m.returnOnBorrowed)} against {pct((inputs.heloc.ratePct ?? 0) / 100)} cost
            </p>
            <p className={(m.borrowedSpread ?? 0) >= 0 ? "text-emerald-800" : "text-red-800"}>
              {(m.borrowedSpread ?? 0) >= 0
                ? `You keep ${pct(m.borrowedSpread)} on every dollar drawn (${money((m.borrowedSpread ?? 0) * m.helocDraw)} a year).`
                : `You lose ${pct(Math.abs(m.borrowedSpread ?? 0))} on every dollar drawn (${money((m.borrowedSpread ?? 0) * m.helocDraw)} a year).`}
            </p>
          </div>
        )}
        {offer !== null && (
          <p className="text-xs text-slate-500 mt-2">
            Highest price that still meets your goals: <b className="text-slate-900">{money(offer)}</b>
            {offer < home.price ? ` — ${money(home.price - offer)} below asking` : " — above asking"}
          </p>
        )}

        {scenarios.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">If occupancy is different</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 pr-2 font-medium">Occupancy</th>
                  <th className="py-1 pr-2 font-medium">Cash flow</th>
                  <th className="py-1 pr-2 font-medium">On borrowed $</th>
                  <th className="py-1 font-medium">Max offer</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr key={s.occupancyPct} className="border-t border-slate-100">
                    <td className="py-1 pr-2 text-slate-700">{s.occupancyPct}% <span className="text-slate-400">{s.label}</span></td>
                    <td className={`py-1 pr-2 font-medium ${(s.cashFlow ?? 0) < 0 ? "text-red-600" : "text-slate-900"}`}>{money(s.cashFlow)}</td>
                    <td className={`py-1 pr-2 ${(s.returnOnBorrowed ?? 0) < (inputs.heloc.ratePct ?? 0) / 100 ? "text-red-600" : "text-emerald-700"}`}>
                      {pct(s.returnOnBorrowed)}
                    </td>
                    <td className="py-1 text-slate-700">{s.maxOffer === null ? "none" : money(s.maxOffer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-400 mt-1">Occupancy is the number nobody knows in advance. If the deal only works at the top row, it&apos;s a bet.</p>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-600">What if you offered less?</p>
          <div className="flex flex-wrap items-end gap-2 mt-1.5">
            <div className="w-40">
              <NumberField label="Your offer" prefix="$" step="1000" value={offerPrice}
                onChange={setOfferPrice} placeholder={String(home.price)} />
            </div>
            {offer !== null && offer !== home.price && (
              <Button size="sm" variant="outline" onClick={() => setOfferPrice(offer)}>
                Use {money(offer)}
              </Button>
            )}
            {offerPrice !== null && (
              <Button size="sm" variant="outline" onClick={() => setOfferPrice(null)}>
                Back to asking
              </Button>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            {offerPrice !== null && offerPrice > 0 ? (
              <>
                Every number in this panel is now at <b>{money(price)}</b>
                {price < home.price && <> — {money(home.price - price)} below asking</>}
                {price > home.price && <> — {money(price - home.price)} above asking</>}.
              </>
            ) : (
              <>Showing the asking price of {money(home.price)}. Type an offer to see what it would do.</>
            )}
          </p>
        </div>

      </div>
      <div className="space-y-6">
        <ProjectionPanel p={projection} inputs={inputs} />
        <CountyPanel home={home} market={market} onRefresh={onRefreshCounty} refreshing={refreshing} />
      </div>
    </div>
  )
}

export default function MarketAnalysisPage() {
  const [data, setData] = useState<Data | null>(null)
  const [draft, setDraft] = useState<MarketAnalysisInputs | null>(null)
  const [marketId, setMarketId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>("cashFlow")
  const [onlyGoals, setOnlyGoals] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [refreshingCounty, setRefreshingCounty] = useState<string | null>(null)
  const [valueLookup, setValueLookup] = useState<number | null>(null)
  // Most fields are defaults that rarely change; keep them out of the way
  const [showAdvanced, setShowAdvanced] = useState(false)
  // Settings are a twice-a-year job. They live behind a button so the page
  // is about houses, not about forms.
  const [showSettings, setShowSettings] = useState(false)
  const [placeQuery, setPlaceQuery] = useState("")
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [searchingPlace, setSearchingPlace] = useState(false)

  const load = useCallback(async (resetDraft: boolean) => {
    try {
      const res = await fetch("/api/market-analysis")
      if (!res.ok) return
      const d: Data = await res.json()
      setData(d)
      if (resetDraft) setDraft(d.inputs)
      setMarketId((cur) => cur ?? d.inputs.markets[0]?.id ?? null)
    } catch {
      // keep what's on screen
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(true) }, [load])

  const running = data?.lastRun?.status === "RUNNING"
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => load(false), 10000)
    return () => clearInterval(t)
  }, [running, load])

  const dirty = !!data && !!draft && JSON.stringify(draft) !== JSON.stringify(data.inputs)
  const market = draft?.markets.find((m) => m.id === marketId) ?? draft?.markets[0] ?? null

  function setGlobal<K extends keyof MarketAnalysisInputs>(section: K, patch: Partial<MarketAnalysisInputs[K]>) {
    setDraft((d) => (d ? { ...d, [section]: { ...d[section], ...patch } } : d))
  }

  function setMarket(patch: Partial<MarketSettings>) {
    setDraft((d) =>
      d ? { ...d, markets: d.markets.map((m) => (m.id === market?.id ? { ...m, ...patch } : m)) } : d,
    )
  }

  function addMarket(place: Place) {
    const id = marketIdFromLabel(place.label)
    setDraft((d) => {
      if (!d) return d
      if (d.markets.some((m) => m.id === id)) return d
      return {
        ...d,
        markets: [
          ...d.markets,
          {
            id,
            label: place.label,
            state: place.state,
            county: place.county,
            centerLat: place.latitude,
            centerLng: place.longitude,
            radiusMiles: 12,
            active: true,
            buyBox: DEFAULT_BUY_BOX,
            expenses: DEFAULT_EXPENSES,
            occupancyPct: null,
            nightlyOverride: null,
            strRules: DEFAULT_STR_RULES,
          },
        ],
      }
    })
    setMarketId(id)
    setPlaces(null)
    setPlaceQuery("")
    setMessage({ ok: true, text: `Added ${place.label}. Save, then Update now to pull its listings.` })
  }

  function removeMarket(id: string) {
    if (!confirm("Remove this market? Its saved settings are deleted; listings already collected stay until they age out.")) return
    setDraft((d) => (d ? { ...d, markets: d.markets.filter((m) => m.id !== id) } : d))
    setMarketId((cur) => (cur === id ? (draft?.markets.find((m) => m.id !== id)?.id ?? null) : cur))
  }

  async function searchPlaces() {
    if (!placeQuery.trim()) return
    setSearchingPlace(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/market-analysis/geocode?q=${encodeURIComponent(placeQuery)}`)
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ ok: false, text: d.error ?? "Couldn't look that up." })
        return
      }
      setPlaces(d.places ?? [])
    } catch {
      setMessage({ ok: false, text: "Couldn't look that up. Please try again." })
    } finally {
      setSearchingPlace(false)
    }
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/market-analysis/inputs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ ok: false, text: d.error ?? "Couldn't save." })
        return
      }
      setData((cur) => (cur ? { ...cur, inputs: d.inputs } : cur))
      setDraft(d.inputs)
      setMessage({ ok: true, text: "Inputs saved." })
    } catch {
      setMessage({ ok: false, text: "Couldn't save. Please try again." })
    } finally {
      setSaving(false)
    }
  }

  async function resetToDefaults() {
    if (!confirm("Reset every market and assumption to the starting values? Your saved numbers will be cleared.")) return
    setSaving(true)
    try {
      const res = await fetch("/api/market-analysis/inputs", { method: "DELETE" })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setData((cur) => (cur ? { ...cur, inputs: d.inputs } : cur))
        setDraft(d.inputs)
        setMarketId(d.inputs.markets[0]?.id ?? null)
        setMessage({ ok: true, text: "Inputs reset to defaults." })
      }
    } finally {
      setSaving(false)
    }
  }

  async function updateNow() {
    setStarting(true)
    setMessage(null)
    try {
      if (dirty) await save()
      const res = await fetch("/api/market-analysis/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market?.id }),
      })
      if (!res.ok) setMessage({ ok: false, text: "Couldn't start the update." })
      await load(false)
    } finally {
      setStarting(false)
    }
  }

  async function refreshCounty(listingId: string) {
    setRefreshingCounty(listingId)
    try {
      const res = await fetch("/api/market-analysis/county", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      })
      const d = await res.json().catch(() => ({}))
      setData((cur) =>
        cur
          ? {
              ...cur,
              homes: cur.homes.map((h) =>
                h.id === listingId ? { ...h, county: d.county ?? h.county, countyError: d.countyError ?? d.error ?? null } : h,
              ),
            }
          : cur,
      )
    } finally {
      setRefreshingCounty(null)
    }
  }

  async function lookupEquityValue(index: number) {
    const source = draft?.heloc.equitySources[index]
    if (!source?.address) return
    setValueLookup(index)
    try {
      const res = await fetch("/api/market-analysis/county", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: source.address }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.county?.justValue) {
        updateSource(index, { homeValue: d.county.justValue })
        setMessage({ ok: true, text: `County just value for ${source.label || source.address}: ${money(d.county.justValue)}. Market value is often higher.` })
      } else {
        setMessage({ ok: false, text: d.error ?? "Couldn't find that address in county records." })
      }
    } finally {
      setValueLookup(null)
    }
  }

  function updateSource(index: number, patch: Partial<MarketAnalysisInputs["heloc"]["equitySources"][number]>) {
    setDraft((d) =>
      d ? { ...d, heloc: { ...d.heloc, equitySources: d.heloc.equitySources.map((s, i) => (i === index ? { ...s, ...patch } : s)) } } : d,
    )
  }

  const heloc = draft ? helocCapacity(draft.heloc) : { gross: 0, available: 0 }
  const signals = market && data ? data.signalsByMarket[market.id] : undefined
  const occupancy = useMemo(
    () =>
      market && data
        ? {
            ...resolveOccupancy(market, data.occupancyByMarket, data.ownOccupancy, data.priceEvalOccupancy),
            signals: signals ? { months: signals.months, achievedRatio: signals.achievedRatio } : null,
          }
        : { market: null, own: null, bookedAhead: null, listings: 0, historyDays: 0, signals: null },
    [market, data, signals],
  )

  const samplesFor = useCallback(
    (id: string) => (data ? data.strSamples.filter((s) => !s.marketId || s.marketId === id) : []),
    [data],
  )
  const occupancyFor = useCallback(
    (mk: MarketSettings) => {
      if (!data) return { market: null, own: null, signals: null }
      const sig = data.signalsByMarket[mk.id]
      return {
        ...resolveOccupancy(mk, data.occupancyByMarket, data.ownOccupancy, data.priceEvalOccupancy),
        signals: sig ? { months: sig.months, achievedRatio: sig.achievedRatio } : null,
      }
    },
    [data],
  )

  const scorecard: ScoreRow[] = useMemo(() => {
    if (!data || !draft) return []
    return draft.markets.map((mk) => {
      const samples = data.strSamples.filter((s) => !s.marketId || s.marketId === mk.id)
      const sig = data.signalsByMarket[mk.id]
      const occ = {
        ...resolveOccupancy(mk, data.occupancyByMarket, data.ownOccupancy, data.priceEvalOccupancy),
        signals: sig ? { months: sig.months, achievedRatio: sig.achievedRatio } : null,
      }
      const homes = data.homes.filter((h) => (h.marketId ? h.marketId === mk.id : true))
      const box = homes.filter((h) => inBuyBox(h, mk))
      const metrics = box.map((h) => analyzeDeal(h, mk, draft, samples, occ, heloc.available))
      const flows = metrics.map((m) => m.cashFlow).filter((v): v is number => v !== null)
      const bestIdx = metrics.reduce(
        (bi, m, i) => ((m.cashFlow ?? -Infinity) > (metrics[bi]?.cashFlow ?? -Infinity) ? i : bi),
        -1,
      )
      const bestBox = bestIdx >= 0 ? box[bestIdx] : null
      const nightlies = samples.map((s) => s.nightly).sort((a, b) => a - b)
      const resolved = mk.occupancyPct !== null ? mk.occupancyPct / 100 : occ.market ?? occ.own
      return {
        market: mk,
        forSale: homes.length,
        inBox: box.length,
        clearing: metrics.filter((m) => m.meetsGoals).length,
        bestCashFlow: flows.length ? Math.max(...flows) : null,
        bestHome: bestBox ? { address: bestBox.address, price: bestBox.price, id: bestBox.id } : null,
        medianNightly: nightlies.length ? nightlies[Math.floor(nightlies.length / 2)] : null,
        listings: occ.listings,
        occupancy: resolved,
        occupancyIsOwn: mk.occupancyPct === null && occ.market === null,
        historyDays: occ.historyDays,
      }
    })
  }, [data, draft, heloc.available])

  // The first market in the list is rarely the best one. Land on whichever
  // one actually has deals, but only before the user has chosen for himself.
  const autoPicked = useRef(false)
  useEffect(() => {
    if (autoPicked.current || scorecard.length < 2) return
    autoPicked.current = true
    const best = [...scorecard].sort(
      (a, b) => b.clearing - a.clearing || (b.bestCashFlow ?? -Infinity) - (a.bestCashFlow ?? -Infinity),
    )[0]
    if (best) setMarketId(best.market.id)
  }, [scorecard])

  const results = useMemo(() => {
    if (!data || !draft || !market) return []
    const samples = data.strSamples.filter((s) => !s.marketId || s.marketId === market.id)
    return data.homes
      .filter((h) => (h.marketId ? h.marketId === market.id : true) && inBuyBox(h, market))
      .map((home) => ({
        home,
        m: analyzeDeal(home, market, draft, samples, occupancy, heloc.available),
        offer: maxOffer(home, market, draft, samples, occupancy, heloc.available),
      }))
  }, [data, draft, market, occupancy, heloc.available])

  // A column whose every cell reads the same carries no information but
  // costs a glance on every row. Say it once, above the list.
  const uniformOccupancy = useMemo(() => {
    if (!results.length) return null
    const first = results[0].m
    const same = results.every(
      (r) => r.m.occupancySource === first.occupancySource && Math.abs((r.m.occupancy ?? 0) - (first.occupancy ?? 0)) < 0.0001,
    )
    return same ? { occupancy: first.occupancy, source: first.occupancySource } : null
  }, [results])

  const sorted = useMemo(() => {
    const list = onlyGoals ? results.filter((r) => r.m.meetsGoals) : [...results]
    const val = (r: (typeof results)[number]) => {
      switch (sortBy) {
        case "cashFlow": return r.m.cashFlow ?? -Infinity
        case "cashOnCash": return r.m.cashOnCash ?? (r.m.ownCash <= 0 && (r.m.cashFlow ?? 0) > 0 ? Infinity : -Infinity)
        case "capRate": return r.m.capRate ?? -Infinity
        case "maxOffer": return r.offer === null ? -Infinity : r.offer - r.home.price
        case "price": return -r.home.price
        case "newest": return -(r.home.daysOnMarket ?? 9999)
      }
    }
    return list.sort((a, b) => val(b) - val(a))
  }, [results, sortBy, onlyGoals])

  const mapHomes: MapHome[] = useMemo(
    () =>
      (onlyGoals ? results.filter((r) => r.m.meetsGoals) : results).map(({ home, m }) => ({
        id: home.id,
        address: home.address,
        latitude: home.latitude,
        longitude: home.longitude,
        price: home.price,
        cashFlow: m.cashFlow,
        meetsGoals: m.meetsGoals,
      })),
    [results, onlyGoals],
  )

  if (loading || !data || !draft || !market) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>
  }

  // The few blanks that actually change the answer
  const setupTodo = [
    heloc.available <= 0 ? "The amount your bank approved on the equity line" : null,
    draft.heloc.ratePct === null ? "The rate your bank quoted on the equity line" : null,
  ].filter((t): t is string => t !== null)

  const marketHomes = data.homes.filter((h) => (h.marketId ? h.marketId === market.id : true))
  // Staleness is a fact about this market, not about the last run of any
  // market, so it is measured from this market's own listings.
  // Which of the four sources the occupancy actually came from. A number
  // nobody measured shouldn't be handing out green ticks in silence.
  const occupancySource: DealMetrics["occupancySource"] =
    market.occupancyPct !== null ? "override"
      : occupancy.market !== null ? "market"
        : occupancy.own !== null ? "own"
          : occupancy.bookedAhead != null ? "bookedAhead"
            : "fallback"
  const seenOn = data.listingsSeenByMarket?.[market.id] ?? null
  const daysStale =
    seenOn && data.today
      ? Math.round((Date.parse(`${data.today}T00:00:00Z`) - Date.parse(`${seenOn}T00:00:00Z`)) / 86_400_000)
      : null
  const goalCount = results.filter((r) => r.m.meetsGoals).length
  const best = [...results].sort((a, b) => (b.m.cashFlow ?? -Infinity) - (a.m.cashFlow ?? -Infinity))[0]
  const bestOffer = [...results].sort((a, b) => (b.offer ?? -Infinity) - (a.offer ?? -Infinity))[0]

  return (
    <div className="min-h-screen">
      <Header title="Market Analysis" subtitle="Homes for sale that could grow the portfolio" />

      <div className="p-4 sm:p-6 max-w-7xl space-y-6">
        <Verdict rows={scorecard} currentId={market.id} onPick={(id) => { setMarketId(id); setExpanded(null) }} />

        {/* Markets */}
        <div className="flex flex-wrap items-center gap-2">
          {draft.markets.map((m) => (
            <button key={m.id} onClick={() => { setMarketId(m.id); setExpanded(null) }}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                m.id === market.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}>
              {m.label}
              {!m.active && <span className="ml-1.5 text-xs opacity-70">(paused)</span>}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchPlaces())}
              placeholder="Add a market: city, state"
              className="px-3 py-2 text-sm border border-dashed border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
            <Button size="sm" variant="outline" onClick={searchPlaces} loading={searchingPlace}>
              {!searchingPlace && <Plus className="w-4 h-4" />} Add
            </Button>
          </div>
        </div>

        {places && (
          <Card padding="sm">
            {places.length === 0 ? (
              <p className="text-sm text-slate-500">No places found. Try &quot;City, State&quot;.</p>
            ) : (
              <div className="space-y-1">
                {places.map((p) => (
                  <button key={p.displayName} onClick={() => addMarket(p)}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{p.label}</span>
                      <span className="block text-xs text-slate-500">{p.displayName}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {!running && seenOn
              ? `${market.label}: ${marketHomes.length} for sale, last checked ${daysStale === 0 ? "today" : daysStale === 1 ? "yesterday" : `${daysStale} days ago`}`
              : null}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowSettings(true)}>
              <SlidersHorizontal className="w-4 h-4" /> Settings
              {dirty && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-500" title="Unsaved changes" />}
            </Button>
            <Button size="sm" variant="outline" onClick={updateNow} loading={starting} disabled={running}>
              {!starting && <RefreshCw className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />}
              {running ? "Updating…" : `Update ${market.label}`}
            </Button>
          </div>
        </div>

        {(occupancySource === "fallback" || occupancySource === "bookedAhead") && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                {occupancySource === "bookedAhead"
                  ? `${market.label} is priced on a conservative floor, not a measured year`
                  : `Nothing here is measured yet — ${market.label} is running on a plain 50% occupancy guess`}
              </p>
              <p className="text-sm text-amber-800 mt-0.5">
                {occupancySource === "bookedAhead" ? (
                  <>
                    Competitors here are <b>{pct(occupancy.bookedAhead, 0)} booked for the coming month</b> — real, but it
                    reads low as a yearly figure because near dates keep filling in. Anything clearing your goals at this
                    rate has room underneath it; anything failing might still work. A full year of competitors&apos;
                    calendars lands on day 30 (day {occupancy.historyDays} of 30).
                  </>
                ) : (
                  <>
                    Occupancy decides every number below it, and a guess can turn losing houses green. Type what you
                    believe for this market, or wait for its competitors&apos; calendars to reach 30 days
                    {occupancy.historyDays > 0 ? ` (day ${occupancy.historyDays} of 30)` : ""}.
                  </>
                )}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowSettings(true)}>Set occupancy</Button>
          </div>
        )}

        {daysStale !== null && daysStale >= 2 && !running && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-100">
            <p className="text-sm text-amber-900">
              These {market.label} listings were last checked <b>{daysStale} days ago</b>. Prices and new listings since
              then aren&apos;t here yet.
            </p>
            <Button size="sm" variant="outline" onClick={updateNow} loading={starting} disabled={running}>
              {!starting && <RefreshCw className="w-4 h-4" />} Update now
            </Button>
          </div>
        )}

        {setupTodo.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-100">
            <p className="text-sm text-amber-900">
              <b>Worth filling in:</b> {setupTodo.join(" · ")}. Until then these numbers run on an estimate.
            </p>
            <Button size="sm" variant="outline" onClick={() => setShowSettings(true)}>Open settings</Button>
          </div>
        )}

        {running && (
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-center gap-3">
            <Spinner size="sm" />
            <p className="text-sm text-blue-900">Pulling homes for sale, Airbnb rates, and county records. A couple of minutes.</p>
          </div>
        )}
        {data.lastRun?.status === "FAILED" && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3 text-sm text-red-800">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div><p className="font-semibold">The last update didn&apos;t finish</p><p>{data.lastRun.error}</p></div>
          </div>
        )}
        {data.lastRun?.status === "COMPLETE" && data.lastRun.error && (
          <p className="text-xs text-amber-700 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {data.lastRun.error}</p>
        )}

        {showSettings && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setShowSettings(false)} aria-hidden />
            <div className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
                <p className="text-sm font-bold text-slate-900">Settings</p>
                <button type="button" onClick={() => setShowSettings(false)} aria-label="Close settings"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Card padding="none" className="border-0 shadow-none rounded-none">
            <div className="p-4 border-b border-slate-100">
              <p className="text-sm font-bold text-slate-900">Your inputs</p>
              <p className="text-xs text-slate-500 mt-0.5">Results update as you type. Everything else has a sensible default — open Fine-tune only if you want to change it.</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>{!saving && <Save className="w-3.5 h-3.5" />} Save</Button>
                <Button size="sm" variant="outline" onClick={() => setDraft(data.inputs)} disabled={!dirty}>Discard</Button>
                <Button size="sm" variant="ghost" onClick={resetToDefaults}><RotateCcw className="w-3.5 h-3.5" /> Defaults</Button>
              </div>
              <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showAdvanced ? "Hide the details" : "Show the details (costs, occupancy, loan terms, taxes)"}
              </button>

              {setupTodo.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-xs font-semibold text-amber-900">Worth filling in</p>
                  <ul className="mt-1 space-y-1">
                    {setupTodo.map((t) => (
                      <li key={t} className="text-xs text-amber-800 flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {dirty && <p className="text-xs text-amber-700 mt-2">Unsaved changes</p>}
              {message && (
                <p className={`text-xs mt-2 flex items-start gap-1 ${message.ok ? "text-emerald-700" : "text-red-600"}`}>
                  {message.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                  {message.text}
                </p>
              )}
            </div>

            <div className="px-4 max-h-none lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto">
              <Section title={`${market.label}: can you rent it nightly?`} subtitle="Check this before anything else" defaultOpen>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(STR_LEGALITY) as StrLegality[]).map((k) => {
                    const on = market.strRules.status === k
                    return (
                      <button key={k} type="button"
                        onClick={() => setMarket({ strRules: { ...market.strRules, status: k, checkedOn: k === "unknown" ? null : new Date().toISOString().slice(0, 10) } })}
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${on ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"}`}>
                        {STR_LEGALITY[k].label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-slate-400">{STR_LEGALITY[market.strRules.status].blurb}</p>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">What the rule says</span>
                  <textarea value={market.strRules.note} rows={2}
                    onChange={(e) => setMarket({ strRules: { ...market.strRules, note: e.target.value } })}
                    placeholder="e.g. 7-night minimum outside the resort district; annual permit $250"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Link to the ordinance</span>
                  <input value={market.strRules.sourceUrl} type="url"
                    onChange={(e) => setMarket({ strRules: { ...market.strRules, sourceUrl: e.target.value } })}
                    placeholder="https://..."
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <p className="text-[11px] text-slate-400">
                  No tool buys this data reliably, so you confirm it once per market. It is the one input that can
                  make every other number here worthless.
                </p>
              </Section>

              <Section title={`${market.label}: area & buy box`} subtitle="Applies to this market only">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Market name</span>
                  <input value={market.label} onChange={(e) => setMarket({ label: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <p className="text-[11px] text-slate-400">Drag the blue pin on the map to move the area, and the small handle to change the radius.</p>
                {showAdvanced && (
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField label="Center latitude" value={market.centerLat} onChange={(v) => setMarket({ centerLat: v ?? market.centerLat })} />
                    <NumberField label="Center longitude" value={market.centerLng} onChange={(v) => setMarket({ centerLng: v ?? market.centerLng })} />
                  </div>
                )}
                <NumberField label="Search radius" suffix="miles" value={market.radiusMiles} onChange={(v) => setMarket({ radiusMiles: v ?? 12 })}
                  hint="Changing the area needs Update now to pull listings there." />
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Min price" prefix="$" step="1000" value={market.buyBox.minPrice} onChange={(v) => setMarket({ buyBox: { ...market.buyBox, minPrice: v } })} placeholder="Any" />
                  <NumberField label="Max price" prefix="$" step="1000" value={market.buyBox.maxPrice} onChange={(v) => setMarket({ buyBox: { ...market.buyBox, maxPrice: v } })} placeholder="Any" />
                  <NumberField label="Min bedrooms" step="1" value={market.buyBox.minBeds} onChange={(v) => setMarket({ buyBox: { ...market.buyBox, minBeds: v } })} placeholder="Any" />
                  <NumberField label="Min bathrooms" step="0.5" value={market.buyBox.minBaths} onChange={(v) => setMarket({ buyBox: { ...market.buyBox, minBaths: v } })} placeholder="Any" />
                </div>
                {showAdvanced && (
                  <>
                    <NumberField label="Max days on market" step="1" value={market.buyBox.maxDaysOnMarket} onChange={(v) => setMarket({ buyBox: { ...market.buyBox, maxDaysOnMarket: v } })} placeholder="Any" />
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-1">Property types</p>
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(PROPERTY_TYPES) as PropertyTypeKey[]).map((k) => {
                          const on = market.buyBox.propertyTypes.includes(k)
                          return (
                            <button key={k} type="button"
                              onClick={() => setMarket({ buyBox: { ...market.buyBox, propertyTypes: on ? market.buyBox.propertyTypes.filter((t) => t !== k) : [...market.buyBox.propertyTypes, k] } })}
                              className={`px-3 py-1 rounded-full text-xs font-medium border ${on ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"}`}>
                              {PROPERTY_TYPES[k].label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <Toggle label="Pool required" checked={market.buyBox.poolRequired} onChange={(v) => setMarket({ buyBox: { ...market.buyBox, poolRequired: v } })}
                      hint={hasCountyRecords(market) ? "Confirmed from county records, so only homes with records pulled will show." : "County records aren't available here, so this would hide everything."} />
                  </>
                )}
                <Toggle label="Include in the daily update" checked={market.active} onChange={(v) => setMarket({ active: v })} />
                {draft.markets.length > 1 && (
                  <button type="button" onClick={() => removeMarket(market.id)}
                    className="text-xs text-red-600 hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3" /> Remove this market</button>
                )}
              </Section>

              <Section title={`${market.label}: costs & occupancy`} subtitle="The app fills these in — change them only if you know better" show={showAdvanced}>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Cleaning per turnover" prefix="$" value={market.expenses.cleaningCostPerTurn} onChange={(v) => setMarket({ expenses: { ...market.expenses, cleaningCostPerTurn: v } })} />
                  <NumberField label="Utilities / month" prefix="$" value={market.expenses.utilitiesMonthly} onChange={(v) => setMarket({ expenses: { ...market.expenses, utilitiesMonthly: v } })} hint="Power, water, internet, TV" />
                  <NumberField label="Insurance / year" prefix="$" value={market.expenses.insuranceAnnual} onChange={(v) => setMarket({ expenses: { ...market.expenses, insuranceAnnual: v } })} />
                  <NumberField label="Property tax" suffix="% of price" step="0.05" value={market.expenses.propertyTaxPct} onChange={(v) => setMarket({ expenses: { ...market.expenses, propertyTaxPct: v } })} hint="Varies a lot by state" />
                </div>
                {showAdvanced && (
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField label="Other / month" prefix="$" value={market.expenses.otherMonthly} onChange={(v) => setMarket({ expenses: { ...market.expenses, otherMonthly: v } })} hint="Pool, lawn, pest, software" />
                    <NumberField label="Supplies & repairs" suffix="% of rev" value={market.expenses.suppliesMaintenancePct} onChange={(v) => setMarket({ expenses: { ...market.expenses, suppliesMaintenancePct: v } })} />
                    <NumberField label="Capital reserve" suffix="% of rev" value={market.expenses.capexReservePct} onChange={(v) => setMarket({ expenses: { ...market.expenses, capexReservePct: v } })} hint="Roof, AC, appliances" />
                    <NumberField label="Management" suffix="% of rev" value={market.expenses.managementPct} onChange={(v) => setMarket({ expenses: { ...market.expenses, managementPct: v } })} hint="0 if you self-manage" />
                  </div>
                )}
                <NumberField label="Occupancy" suffix="%" value={market.occupancyPct} onChange={(v) => setMarket({ occupancyPct: v })} placeholder="Estimate"
                  hint={occupancy.market !== null
                    ? `Blank uses ${occupancy.listings} nearby Airbnbs: ${pct(occupancy.market, 0)}`
                    : occupancy.bookedAhead !== null
                      ? `Now using ${pct(occupancy.own, 0)} from your houses. Competitors here are ${pct(occupancy.bookedAhead, 0)} booked for next month (day ${occupancy.historyDays} of 30).`
                      : `Blank uses ${pct(occupancy.own, 0)} from your own houses`} />
                {showAdvanced && (
                  <NumberField label="Nightly rate (to you)" prefix="$" value={market.nightlyOverride} onChange={(v) => setMarket({ nightlyOverride: v })} placeholder="Estimate per home"
                    hint="Leave blank to estimate each home from nearby Airbnbs with the same bedrooms" />
                )}
              </Section>

              <Section title="Home equity line" subtitle="The cash that buys the house — shared by every market, set it once" defaultOpen>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Approved amount" prefix="$" step="1000" value={draft.heloc.limitOverride}
                    onChange={(v) => setGlobal("heloc", { limitOverride: v })} placeholder="From your bank"
                    hint="The number the bank approved you to borrow" />
                  <NumberField label="Interest rate" suffix="%" step="0.125" value={draft.heloc.ratePct}
                    onChange={(v) => setGlobal("heloc", { ratePct: v })} hint="What the bank quoted you" />
                </div>
                <p className="text-xs text-slate-500">
                  Available to spend: <b className="text-slate-900">{money(heloc.available)}</b>
                  {(draft.heloc.alreadyDrawn ?? 0) > 0 && ` \u2014 after ${money(draft.heloc.alreadyDrawn)} already drawn`}
                </p>
                {draft.heloc.limitOverride === null && (
                  <p className="text-[11px] text-slate-400">
                    That&apos;s an estimate from your own homes&apos; values. Type the bank&apos;s approved number above to use the real one.
                  </p>
                )}
                {showAdvanced && (
                  <>
                    <p className="text-[11px] text-slate-400">
                      Leave the approved amount blank to work it out from your own homes instead.
                    </p>
                    {draft.heloc.equitySources.map((s, i) => (
                      <div key={i} className="p-3 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex items-center gap-2">
                          <input value={s.label} placeholder="Property name" onChange={(e) => updateSource(i, { label: e.target.value })}
                            className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <button type="button" onClick={() => setGlobal("heloc", { equitySources: draft.heloc.equitySources.filter((_, j) => j !== i) })}
                            className="p-1 text-slate-400 hover:text-red-500" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <input value={s.address} placeholder="Street address (for county lookup)" onChange={(e) => updateSource(i, { address: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <div className="grid grid-cols-2 gap-2">
                          <NumberField label="Home value" prefix="$" step="1000" value={s.homeValue} onChange={(v) => updateSource(i, { homeValue: v })} />
                          <NumberField label="Mortgage owed" prefix="$" step="1000" value={s.mortgageBalance} onChange={(v) => updateSource(i, { mortgageBalance: v })} />
                        </div>
                        <button type="button" onClick={() => lookupEquityValue(i)} disabled={valueLookup === i || !s.address}
                          className="text-xs text-blue-600 hover:underline disabled:text-slate-400 flex items-center gap-1">
                          {valueLookup === i ? <Spinner size="sm" /> : <Landmark className="w-3 h-3" />} Fill home value from county records
                        </button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setGlobal("heloc", { equitySources: [...draft.heloc.equitySources, { label: "", address: "", homeValue: null, mortgageBalance: null }] })}>
                      <Plus className="w-3.5 h-3.5" /> Add property
                    </Button>
                    <div className="grid grid-cols-2 gap-3">
                      <NumberField label="Max borrowing" suffix="% of value" value={draft.heloc.maxCltvPct} onChange={(v) => setGlobal("heloc", { maxCltvPct: v })} hint="Lenders usually allow 80–85%" />
                      <NumberField label="Already drawn" prefix="$" step="1000" value={draft.heloc.alreadyDrawn} onChange={(v) => setGlobal("heloc", { alreadyDrawn: v })} />
                    </div>
                    <Toggle label="Interest-only payments" checked={draft.heloc.interestOnly} onChange={(v) => setGlobal("heloc", { interestOnly: v })} hint="Typical during a HELOC's draw period" />
                    {!draft.heloc.interestOnly && (
                      <NumberField label="Repay over" suffix="years" step="1" value={draft.heloc.repayYears} onChange={(v) => setGlobal("heloc", { repayYears: v })} />
                    )}
                    <Toggle label="Use it for down payment, closing & furnishing" checked={draft.heloc.useForCashNeeded} onChange={(v) => setGlobal("heloc", { useForCashNeeded: v })} />
                  </>
                )}
              </Section>

              <Section title="Purchase loan" subtitle="Shared across every market" show={showAdvanced}>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Down payment" suffix="%" value={draft.loan.downPaymentPct} onChange={(v) => setGlobal("loan", { downPaymentPct: v })} />
                  <NumberField label="Interest rate" suffix="%" step="0.125" value={draft.loan.ratePct} onChange={(v) => setGlobal("loan", { ratePct: v })} />
                  <NumberField label="Loan term" suffix="years" step="1" value={draft.loan.termYears} onChange={(v) => setGlobal("loan", { termYears: v })} />
                  <NumberField label="Closing costs" suffix="%" step="0.25" value={draft.loan.closingCostPct} onChange={(v) => setGlobal("loan", { closingCostPct: v })} />
                </div>
                <NumberField label="Furnishing & setup" prefix="$" step="500" value={draft.loan.furnishingCost} onChange={(v) => setGlobal("loan", { furnishingCost: v })} />
              </Section>

              <Section title="Booking assumptions" subtitle="Shared across every market" show={showAdvanced}>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Average stay" suffix="nights" step="0.5" value={draft.revenue.avgStayNights} onChange={(v) => setGlobal("revenue", { avgStayNights: v })} />
                  <NumberField label="Airbnb comp radius" suffix="miles" step="0.5" value={draft.revenue.compRadiusMiles} onChange={(v) => setGlobal("revenue", { compRadiusMiles: v })} />
                  <NumberField label="Airbnb guest fee" suffix="%" value={draft.revenue.guestServiceFeePct} onChange={(v) => setGlobal("revenue", { guestServiceFeePct: v })} hint="Removed from guest prices" />
                  <NumberField label="Airbnb host fee" suffix="%" value={draft.revenue.hostFeePct} onChange={(v) => setGlobal("revenue", { hostFeePct: v })} />
                </div>
              </Section>

              <Section title="Holding period & taxes" subtitle="Drives the long-term projection" show={showAdvanced}>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Hold for" suffix="years" step="1" value={draft.hold.years} onChange={(v) => setGlobal("hold", { years: v })} />
                  <NumberField label="Appreciation" suffix="% / yr" step="0.5" value={draft.hold.appreciationPct} onChange={(v) => setGlobal("hold", { appreciationPct: v })} />
                  <NumberField label="Rate growth" suffix="% / yr" step="0.5" value={draft.hold.rentGrowthPct} onChange={(v) => setGlobal("hold", { rentGrowthPct: v })} hint="How fast nightly rates rise" />
                  <NumberField label="Cost growth" suffix="% / yr" step="0.5" value={draft.hold.expenseGrowthPct} onChange={(v) => setGlobal("hold", { expenseGrowthPct: v })} />
                  <NumberField label="Selling costs" suffix="%" step="0.5" value={draft.hold.sellingCostPct} onChange={(v) => setGlobal("hold", { sellingCostPct: v })} hint="Agent, title, transfer" />
                  <NumberField label="Your tax rate" suffix="%" value={draft.hold.incomeTaxRatePct} onChange={(v) => setGlobal("hold", { incomeTaxRatePct: v })} />
                  <NumberField label="Land share of price" suffix="%" value={draft.hold.landSharePct} onChange={(v) => setGlobal("hold", { landSharePct: v })} hint="Land can't be depreciated" />
                  <NumberField label="Furnishing write-off" suffix="years" step="1" value={draft.hold.furnishingLifeYears} onChange={(v) => setGlobal("hold", { furnishingLifeYears: v })} />
                  <NumberField label="Bonus depreciation" suffix="%" step="5" value={draft.hold.bonusDepreciationPct} onChange={(v) => setGlobal("hold", { bonusDepreciationPct: v })}
                    hint="Write-off taken in year one on short-life property. 100% under the 2025 bill." />
                  <NumberField label="Cost segregation" suffix="% of building" step="1" value={draft.hold.costSegSharePct} onChange={(v) => setGlobal("hold", { costSegSharePct: v })}
                    hint="Share a study reclassifies as short-life. 0 if you won’t pay for one; 20–25% is typical." />
                </div>
                <p className="text-[11px] text-slate-400">Estimates only, not tax advice. The building depreciates over 27.5 years; losses carry forward.</p>
              </Section>

              <Section title="Your goals" subtitle="Drives the max offer">
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Target cash-on-cash" suffix="%" value={draft.goals.targetCashOnCashPct} onChange={(v) => setGlobal("goals", { targetCashOnCashPct: v })} />
                  <NumberField label="Minimum cash flow" prefix="$" step="500" value={draft.goals.targetAnnualCashFlow} onChange={(v) => setGlobal("goals", { targetAnnualCashFlow: v })} hint="Per year, after payments" />
                </div>
                {showAdvanced && (
                  <NumberField label="Min debt coverage" suffix="×" step="0.05" value={draft.goals.minDscr} onChange={(v) => setGlobal("goals", { minDscr: v })} hint="Income ÷ loan payments. Lenders want 1.2+" />
                )}
              </Section>
            </div>
              </Card>
            </div>
          </div>
        )}

        {/* ── Results ── */}
        <div className="space-y-4 min-w-0">
            <LegalityBanner market={market} />

            <MarketScorecard rows={scorecard} currentId={market.id} onPick={(id) => { setMarketId(id); setExpanded(null) }} />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <Stat label="Equity line available" value={money(heloc.available)} sub={heloc.available > 0 ? "Funds each deal's cash needs first" : "Enter your approved amount"} />
              <Stat label={`Homes in ${market.label}`} value={String(results.length)} sub={`of ${marketHomes.length} for sale in the area`} />
              <Stat label="Meet your goals" value={String(goalCount)} sub={draft.goals.targetCashOnCashPct !== null ? `${draft.goals.targetCashOnCashPct}%+ cash-on-cash` : "Positive cash flow"} />
              <Stat
                label="Best max offer vs asking"
                value={bestOffer?.offer != null ? money(bestOffer.offer) : "—"}
                sub={bestOffer?.offer != null ? `${bestOffer.home.address} (asking ${money(bestOffer.home.price)})` : best?.home.address}
              />
            </div>

            <div className="space-y-2">
              <AreaMap
                center={{ lat: market.centerLat, lng: market.centerLng }}
                radiusMiles={market.radiusMiles}
                homes={mapHomes}
                selectedId={expanded}
                onSelectHome={setExpanded}
                onChangeArea={(patch) => setMarket({
                  ...(patch.centerLat !== undefined ? { centerLat: patch.centerLat } : {}),
                  ...(patch.centerLng !== undefined ? { centerLng: patch.centerLng } : {}),
                  ...(patch.radiusMiles !== undefined ? { radiusMiles: patch.radiusMiles } : {}),
                })}
              />
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#1baf7a" }} />Meets your goals</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#64748b" }} />Doesn&apos;t</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#eb6834" }} />Selected</span>
                <span>
                  Every home in your buy box is here — most won&apos;t clear your goals at the asking price, so the big
                  green ones are the ones that do. Tick &quot;Only homes that meet my goals&quot; to hide the rest.
                </span>
              </div>
            </div>

            {signals && (signals.months.length > 0 || signals.achievedRatio !== null) && (
              <Card>
                <CardHeader className="flex-wrap gap-2">
                  <CardTitle className="text-base">Season &amp; real rates in {market.label}</CardTitle>
                  <span className="text-xs text-slate-400">{signals.historyDays} day{signals.historyDays === 1 ? "" : "s"} of collection</span>
                </CardHeader>
                {signals.months.length >= 6 ? (
                  <>
                    <div className="flex items-end gap-1 h-28">
                      {MONTH_NAMES.map((name, i) => {
                        const s = signals.months.find((x) => x.month === i)
                        const rate = s?.rateIndex ?? 1
                        const occ = s?.occupancyIndex ?? 1
                        // Faded bars are months with nothing behind them yet:
                        // calendars only reach about four months out.
                        const hasRate = (s?.samples ?? 0) > 0
                        const hasNights = (s?.nights ?? 0) > 0
                        return (
                          <div key={name} className="flex-1 flex flex-col items-center justify-end gap-0.5"
                            title={`${name}: ${hasRate ? `rates ${Math.round(rate * 100)}% of average` : "no rate data yet"}, ${hasNights ? `bookings ${Math.round(occ * 100)}%` : "no booking data yet"}`}>
                            <div className="w-full flex items-end justify-center gap-0.5 h-20">
                              <div className="w-1/2 rounded-t" style={{ height: `${Math.min(100, rate * 55)}%`, background: "#2a78d6", opacity: hasRate ? 1 : 0.2 }} />
                              <div className="w-1/2 rounded-t" style={{ height: `${Math.min(100, occ * 55)}%`, background: "#1baf7a", opacity: hasNights ? 1 : 0.2 }} />
                            </div>
                            <span className="text-[10px] text-slate-400">{name}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#2a78d6" }} />Nightly rates vs this market&apos;s average</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#1baf7a" }} />Bookings vs average</span>
                      <span>Revenue is spread across the year using this shape, so a peak season no longer hides in one flat number.</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Collecting a price for each of the next 12 months. The seasonal picture appears once six months are in.
                  </p>
                )}
                <div className="mt-4 pt-4 border-t border-slate-100 text-sm">
                  {signals.achievedRatio !== null ? (
                    <p className="text-slate-700">
                      Nights that actually booked went for <b>{money(signals.achievedMedian)}</b>, against <b>{money(signals.askingMedian)}</b> asked
                      across all nights — <b>{pct(1 - signals.achievedRatio, 0)} lower</b>, from {signals.achievedNights} nights now in the past.
                      Estimates are trimmed by that gap.
                    </p>
                  ) : (
                    <p className="text-slate-500">
                      Asking prices are what competitors want; what books is usually less. Once enough sampled nights have
                      passed (a few weeks), the gap is measured and the estimates get trimmed by it.
                    </p>
                  )}
                </div>
              </Card>
            )}

            {marketHomes.length === 0 ? (
              <Card className="text-center py-12">
                <p className="font-semibold text-slate-900">No listings for {market.label} yet</p>
                <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                  Set the area and buy box, then run the update. The morning refresh only runs once this is deployed —
                  until then, Update is what pulls new listings.
                </p>
                <Button className="mt-4" onClick={updateNow} loading={starting}>{!starting && <RefreshCw className="w-4 h-4" />} Pull homes for sale</Button>
              </Card>
            ) : (
              <Card padding="none">
                <CardHeader className="p-4 pb-0 flex-wrap gap-3">
                  <CardTitle className="text-base">Deals ({sorted.length})</CardTitle>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={onlyGoals} onChange={(e) => setOnlyGoals(e.target.checked)} className="rounded" />
                      Only homes that meet my goals
                    </label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
                      <option value="cashFlow">Sort: profit per year</option>
                      <option value="maxOffer">Sort: max offer vs asking</option>
                      <option value="cashOnCash">Sort: cash-on-cash</option>
                      <option value="capRate">Sort: cap rate</option>
                      <option value="price">Sort: lowest price</option>
                      <option value="newest">Sort: newest listings</option>
                    </select>
                  </div>
                </CardHeader>

                {/* What every row shares belongs above the rows, not repeated
                    down a column where it reads as information and isn't. */}
                <p className="px-4 pt-2 text-xs text-slate-500">
                  <span className="font-semibold text-emerald-700">Green</span> pays you every month after every bill and
                  payment; <span className="font-semibold text-red-600">red</span> you cover out of pocket. Tap a home for
                  the full breakdown.
                  {uniformOccupancy && (
                    <> Every home here is priced at <b>{pct(uniformOccupancy.occupancy, 0)} occupancy</b> ({OCCUPANCY_SOURCE[uniformOccupancy.source]}).</>
                  )}
                </p>

                <div className="p-4 pt-3">
                  {/* Column headings only where there are columns — below the
                      phone breakpoint each row stands on its own labels. */}
                  <div className="hidden sm:grid grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))_auto] gap-3 px-3 pb-2 text-xs font-medium text-slate-500">
                    <span>Home</span>
                    <span className="text-right">Asking</span>
                    <span className="text-right" title="The highest price where this house still clears every goal you set">Max offer</span>
                    <span className="text-right" title="What's left after every payment — mortgage, equity line and running costs">Profit per year</span>
                    <span className="w-4" />
                  </div>

                  <div className="space-y-2">
                    {sorted.map(({ home, m, offer }) => {
                      const open = expanded === home.id
                      return (
                        <div key={home.id} className={`rounded-xl border overflow-hidden ${open ? "border-slate-300" : "border-slate-100"}`}>
                          <button type="button" onClick={() => setExpanded(open ? null : home.id)}
                            className={`w-full text-left p-3 grid gap-2 sm:grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))_auto] sm:items-center sm:gap-3 ${open ? "bg-slate-50" : "hover:bg-slate-50/60"}`}>
                            <div className="flex items-start gap-1.5 min-w-0">
                              {m.meetsGoals
                                ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" aria-label="Meets your goals" />
                                : <span className="w-4 h-4 flex-shrink-0" />}
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900">{home.address}</p>
                                <p className="text-xs text-slate-500">
                                  {[home.city, home.beds && `${home.beds} bd`, home.baths && `${home.baths} ba`, home.sqft && `${home.sqft.toLocaleString()} sf`, home.county?.pool && "pool"].filter(Boolean).join(" · ")}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {home.daysOnMarket != null ? `${home.daysOnMarket} days on market` : ""}
                                  {m.likelyExistingStr && (
                                    <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-800"
                                      title="An active Airbnb sits within about 200m of this address with the same bedroom count. Airbnb blurs listing pins, so treat this as a lead to check, not a fact.">
                                      maybe already an Airbnb
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 sm:contents">
                              <div className="min-w-0 sm:text-right">
                                <p className="text-[11px] text-slate-400 sm:hidden">Asking</p>
                                <p className="text-slate-900 whitespace-nowrap">{money(home.price)}</p>
                                {home.previousPrice && home.previousPrice > home.price && (
                                  <p className="text-xs text-emerald-700 flex items-center gap-0.5 sm:justify-end"><TrendingDown className="w-3 h-3" /> was {money(home.previousPrice)}</p>
                                )}
                              </div>
                              <div className="min-w-0 sm:text-right">
                                <p className="text-[11px] text-slate-400 sm:hidden">Max offer</p>
                                {offer === null ? (
                                  <span className="text-slate-400">No price works</span>
                                ) : (
                                  <>
                                    <p className={`font-semibold whitespace-nowrap ${offer >= home.price ? "text-emerald-700" : "text-slate-900"}`}>{money(offer)}</p>
                                    <p className="text-xs text-slate-500">{offer >= home.price ? "at or above asking" : `${money(home.price - offer)} under`}</p>
                                  </>
                                )}
                              </div>
                              <div className="min-w-0 sm:text-right">
                                <p className="text-[11px] text-slate-400 sm:hidden">Profit / yr</p>
                                <p className={`font-semibold whitespace-nowrap ${m.cashFlow == null ? "text-slate-400" : m.cashFlow < 0 ? "text-red-600" : "text-emerald-700"}`}>
                                  {money(m.cashFlow)}
                                </p>
                                {m.cashFlow != null && (
                                  <p className="text-xs text-slate-500">
                                    {m.cashFlow < 0 ? "−" : "+"}{money(Math.abs(m.cashFlow) / 12)}/mo
                                  </p>
                                )}
                              </div>
                            </div>

                            <ChevronDown className={`hidden sm:block w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
                          </button>

                          {open && (
                            <div>
                              {/* The numbers that used to be their own columns:
                                  worth having, not worth 57 repetitions. */}
                              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 border-t border-slate-100 bg-slate-50/60 text-xs text-slate-600">
                                <span>
                                  {money(m.nightly)} × {pct(m.occupancy, 0)}
                                  <span title={CONFIDENCE_LABEL[m.confidence]}
                                    className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${CONFIDENCE_STYLE[m.confidence]}`}>
                                    {m.confidence}
                                  </span>
                                </span>
                                <span>Cash from you <b className="text-slate-900">{money(m.ownCash)}</b></span>
                                <span>
                                  On your cash{" "}
                                  <b className={m.cashOnCash === null ? "text-slate-500" : m.cashOnCash < 0 ? "text-red-600" : "text-emerald-700"}>
                                    {m.cashOnCash !== null ? pct(m.cashOnCash) : m.ownCash <= 0 && m.cashFlow !== null ? "none in" : "—"}
                                  </b>
                                </span>
                                <span>Loan coverage <b className="text-slate-900">{m.dscr !== null ? m.dscr.toFixed(2) : "—"}</b></span>
                                <a href={home.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                                  className="text-blue-600 hover:underline inline-flex items-center gap-1">See it on Redfin <ExternalLink className="w-3 h-3" /></a>
                              </div>
                              {m.goalNotes.length > 0 && (
                                <p className="px-4 pt-3 text-xs text-slate-600 flex items-center gap-1.5 bg-slate-50/60">
                                  <Info className="w-3.5 h-3.5 text-slate-400" /> {m.goalNotes.join(" · ")}
                                </p>
                              )}
                              <DealDetail home={home} inputs={draft} market={market}
                                samples={samplesFor(market.id)} occupancy={occupancy} helocAvailable={heloc.available}
                                onRefreshCounty={() => refreshCounty(home.id)} refreshing={refreshingCounty === home.id} />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {sorted.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-10">No homes match. Loosen the buy box or goals in your inputs.</p>
                  )}
                </div>
              </Card>
            )}

            {/* Tools and reference sit after the answer, not in front of it */}
            <Estimator
              inputs={draft}
              markets={draft.markets}
              samplesFor={samplesFor}
              occupancyFor={occupancyFor}
              helocAvailable={heloc.available}
            />

            <HowItWorks market={market} occupancy={occupancy} signals={signals} inputs={draft} />
        </div>
      </div>
    </div>
  )
}
