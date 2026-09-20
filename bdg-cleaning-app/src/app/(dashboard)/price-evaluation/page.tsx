"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Header } from "@/components/layout/Header"
import { Card, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import type { PriceEvaluation, StayWindowStat } from "@/lib/price-evaluation-types"
import {
  RefreshCw, AlertCircle, ArrowUpRight, ArrowDownRight, Check, Lock, ExternalLink, Info, Star,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"

type Run = { id: string; status: "RUNNING" | "COMPLETE" | "FAILED"; error: string | null; startedAt: string; finishedAt: string | null }
type PropertyOption = { id: string; name: string; trackable: boolean }

// Validated categorical slots 1–3 (colorblind-safe as a set)
const C_MARKET = "#2a78d6"
const C_YOU = "#eb6834"
const C_SUGGESTED = "#1baf7a"

const money = (v: number | null | undefined) => (v == null ? "—" : `$${Math.round(v).toLocaleString()}`)
const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`)
const day = (ymd: string, fmt = "EEE MMM d") => format(new Date(`${ymd}T12:00:00`), fmt)

function describeCriteria(c: PriceEvaluation["criteria"]): string {
  if (!c) return ""
  return [
    `${c.minBedrooms}+ bedrooms`,
    c.minGuests ? `sleeps ${c.minGuests}+` : null,
    c.pool ? "pool" : null,
    c.radiusMiles ? `within ${c.radiusMiles} miles` : null,
  ].filter(Boolean).join(", ")
}

function Kpi({ label, value, you, hint }: { label: string; value: string; you?: string; hint?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {you !== undefined && (
        <p className="text-sm text-slate-600 mt-1">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: C_YOU }} />
          You: <span className="font-semibold text-slate-900">{you}</span>
        </p>
      )}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

function RatesChart({ windows }: { windows: StayWindowStat[] }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const values = windows.flatMap((w) => [w.p25, w.p75, w.yourPrice, w.suggested]).filter((v): v is number => v != null)
  if (!windows.length || !values.length) {
    return <p className="text-sm text-slate-500 py-10 text-center">No prices collected for these dates yet.</p>
  }

  const H = 260
  const pad = { l: 52, r: 16, t: 14, b: 30 }
  const lo = Math.max(0, Math.floor((Math.min(...values) * 0.9) / 50) * 50)
  const hi = Math.ceil((Math.max(...values) * 1.05) / 50) * 50
  const iw = Math.max(10, width - pad.l - pad.r)
  const ih = H - pad.t - pad.b
  const step = windows.length > 1 ? iw / (windows.length - 1) : 0
  const x = (i: number) => pad.l + (windows.length > 1 ? i * step : iw / 2)
  const y = (v: number) => pad.t + ih - ((v - lo) / (hi - lo || 1)) * ih
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4)

  const line = (get: (w: StayWindowStat) => number | null) => {
    let d = ""
    let pen = false
    windows.forEach((w, i) => {
      const v = get(w)
      if (v == null) { pen = false; return }
      d += `${pen ? "L" : "M"}${x(i)},${y(v)}`
      pen = true
    })
    return d
  }
  const banded = windows.map((w, i) => ({ w, i })).filter(({ w }) => w.p25 != null && w.p75 != null)
  const band = banded.length > 1
    ? `M${banded.map(({ w, i }) => `${x(i)},${y(w.p75!)}`).join("L")}L${[...banded].reverse().map(({ w, i }) => `${x(i)},${y(w.p25!)}`).join("L")}Z`
    : ""
  const labelEvery = width < 520 ? 2 : 1
  const h = hover != null ? windows[hover] : null

  return (
    <div ref={boxRef} className="relative">
      <svg width={width} height={H} role="img" aria-label="Nightly rates for upcoming stays: market range, your price, and suggested rate">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} stroke="#f1f5f9" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#94a3b8">${Math.round(t)}</text>
          </g>
        ))}
        {windows.map((w, i) => i % labelEvery === 0 && (
          <text key={w.checkin} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="#94a3b8">{day(w.checkin, "MMM d")}</text>
        ))}

        {band && <path d={band} fill={C_MARKET} fillOpacity={0.14} />}
        <path d={line((w) => w.median)} fill="none" stroke={C_MARKET} strokeWidth={2} strokeLinejoin="round" />
        <path d={line((w) => w.suggested)} fill="none" stroke={C_SUGGESTED} strokeWidth={2} strokeLinejoin="round" />
        {windows.map((w, i) => w.suggested != null && (
          <circle key={`s${i}`} cx={x(i)} cy={y(w.suggested)} r={4} fill={C_SUGGESTED} stroke="#fff" strokeWidth={2} />
        ))}
        {windows.map((w, i) => w.yourPrice != null && (
          <circle key={`y${i}`} cx={x(i)} cy={y(w.yourPrice)} r={5} fill={C_YOU} stroke="#fff" strokeWidth={2} />
        ))}

        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="#cbd5e1" strokeWidth={1} />}
        {windows.map((w, i) => (
          <rect key={`hit${i}`} x={x(i) - Math.max(step, 24) / 2} y={pad.t} width={Math.max(step, 24)} height={ih}
            fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </svg>

      {h && hover != null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-56 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(x(hover) - 112, 0), width - 224) }}
        >
          <p className="font-semibold text-slate-900 mb-1.5">{day(h.checkin)} → {day(h.checkout, "MMM d")}</p>
          <p className="text-slate-600 flex justify-between"><span>Market middle half</span><span className="text-slate-900 font-medium">{money(h.p25)}–{money(h.p75)}</span></p>
          <p className="text-slate-600 flex justify-between"><span className="flex items-center gap-1.5"><span className="w-2 h-0.5" style={{ background: C_MARKET }} />Market median</span><span className="text-slate-900 font-medium">{money(h.median)}</span></p>
          <p className="text-slate-600 flex justify-between"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: C_YOU }} />Your price</span><span className="text-slate-900 font-medium">{h.yourAvailable === false ? "Booked" : money(h.yourPrice)}</span></p>
          <p className="text-slate-600 flex justify-between"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: C_SUGGESTED }} />Suggested</span><span className="text-slate-900 font-medium">{money(h.suggested)}</span></p>
          <p className="text-slate-600 flex justify-between"><span>Similar homes booked</span><span className="text-slate-900 font-medium">{pct(h.marketBookedPct)}</span></p>
          <p className="text-slate-400 mt-1">{h.compCount} similar homes priced</p>
        </div>
      )}
    </div>
  )
}

function Verdict({ w }: { w: StayWindowStat }) {
  if (w.yourAvailable === false) {
    return <span className="inline-flex items-center gap-1 text-slate-500"><Lock className="w-3.5 h-3.5" /> Booked</span>
  }
  if (w.yourPrice == null || w.suggested == null) return <span className="text-slate-400">—</span>
  const diff = w.suggested - w.yourPrice
  if (w.yourPrice < w.suggested * 0.92) {
    return <span className="inline-flex items-center gap-1 text-emerald-700 font-medium"><ArrowUpRight className="w-3.5 h-3.5" /> Raise ~{money(diff)}</span>
  }
  if (w.yourPrice > w.suggested * 1.1) {
    return <span className="inline-flex items-center gap-1 text-amber-700 font-medium"><ArrowDownRight className="w-3.5 h-3.5" /> High by ~{money(-diff)}</span>
  }
  return <span className="inline-flex items-center gap-1 text-slate-600"><Check className="w-3.5 h-3.5" /> On target</span>
}

export default function PriceEvaluationPage() {
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [evaluation, setEvaluation] = useState<PriceEvaluation | null>(null)
  const [lastRun, setLastRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [kind, setKind] = useState<"weekend" | "weekday">("weekend")
  const [error, setError] = useState("")

  const load = useCallback(async (propertyId: string | null) => {
    try {
      const res = await fetch(`/api/price-evaluation${propertyId ? `?propertyId=${propertyId}` : ""}`)
      if (!res.ok) return
      const d = await res.json()
      setProperties(d.properties ?? [])
      setSelectedId(d.selectedId)
      setEvaluation(d.evaluation)
      setLastRun(d.lastRun)
    } catch {
      // keep what's on screen
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(null) }, [load])

  const running = lastRun?.status === "RUNNING"
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => load(selectedId), 10000)
    return () => clearInterval(t)
  }, [running, selectedId, load])

  async function updateNow() {
    setStarting(true)
    setError("")
    try {
      const res = await fetch("/api/price-evaluation/collect", { method: "POST" })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? "Couldn't start the update.")
        return
      }
      await load(selectedId)
    } catch {
      setError("Couldn't start the update. Please try again.")
    } finally {
      setStarting(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>
  }

  const ev = evaluation
  const windows = ev?.windows.filter((w) => w.kind === kind) ?? []
  const selected = properties.find((p) => p.id === selectedId)
  const underpriced = ev?.windows.filter((w) => w.yourAvailable !== false && w.yourPrice != null && w.suggested != null && w.yourPrice < w.suggested * 0.92) ?? []

  return (
    <div className="min-h-screen">
      <Header title="Price Evaluation" subtitle="Your nightly rates against similar homes nearby" />

      <div className="p-4 sm:p-6 max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {properties.map((p) => (
              <button key={p.id} onClick={() => load(p.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  p.id === selectedId ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}>
                {p.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">
              {lastRun?.finishedAt && lastRun.status !== "RUNNING"
                ? `Updated ${formatDistanceToNow(new Date(lastRun.finishedAt), { addSuffix: true })}`
                : null}
            </p>
            <Button size="sm" variant="outline" onClick={updateNow} loading={starting} disabled={running}>
              {!starting && <RefreshCw className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />}
              {running ? "Updating…" : "Update now"}
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {error}</p>}

        {running && (
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-center gap-3">
            <Spinner size="sm" />
            <p className="text-sm text-blue-900">
              Collecting prices and calendars from Airbnb. This takes about 3 minutes; the page refreshes when it&apos;s done.
            </p>
          </div>
        )}
        {lastRun?.status === "FAILED" && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-semibold">The last update didn&apos;t finish</p>
              <p className="mt-0.5">{lastRun.error}</p>
            </div>
          </div>
        )}

        {selected && !selected.trackable ? (
          <Card><p className="text-sm text-slate-600">This property has no Airbnb calendar link, so there&apos;s no listing to compare against.</p></Card>
        ) : !ev?.hasData ? (
          !running && (
            <Card className="text-center py-12">
              <p className="font-semibold text-slate-900">No market data yet</p>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                The app collects prices and calendars for similar homes near each property every morning.
                Run the first update now to see results today.
              </p>
              <Button className="mt-4" onClick={updateNow} loading={starting}>
                {!starting && <RefreshCw className="w-4 h-4" />} Collect market data
              </Button>
            </Card>
          )
        ) : (
          <>
            {ev.historyDays < 30 && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-600">
                  <b>{ev.historyDays} of 30 days</b> of history collected. Until there&apos;s a full month, occupancy
                  and revenue use bookings already on each home&apos;s calendar for the next 30 days, which runs low
                  because last-minute bookings haven&apos;t happened yet.
                </p>
              </div>
            )}

            {underpriced.length > 0 && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-3">
                <ArrowUpRight className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-900">
                  <b>{underpriced.length} open stay{underpriced.length === 1 ? "" : "s"}</b> priced below the suggested rate:{" "}
                  {underpriced.slice(0, 4).map((w) => day(w.checkin, "MMM d")).join(", ")}
                  {underpriced.length > 4 ? "…" : ""}. See the table below.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi label="Weekend nightly (median)" value={money(ev.market?.weekendMedian)} you={money(ev.you?.weekendAvg)} />
              <Kpi label="Weekday nightly (median)" value={money(ev.market?.weekdayMedian)} you={money(ev.you?.weekdayAvg)} />
              <Kpi
                label={ev.market?.occupancy30 != null ? "Occupancy, last 30 days" : "Booked, next 30 days"}
                value={pct(ev.market?.occupancy30 ?? ev.market?.bookedAhead30)}
                you={pct(ev.you?.occupancy30 ?? ev.you?.bookedAhead30)}
              />
              <Kpi label="RevPAR (revenue per available night)" value={money(ev.market?.revpar)} you={money(ev.you?.revpar)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Kpi
                label="Estimated annual revenue, similar homes"
                value={ev.market?.estAnnualRevenue ? money(ev.market.estAnnualRevenue.mid) : "—"}
                hint={ev.market?.estAnnualRevenue ? `Typical range ${money(ev.market.estAnnualRevenue.low)}–${money(ev.market.estAnnualRevenue.high)}` : undefined}
              />
              <Kpi label="Your estimated annual revenue" value={money(ev.you?.estAnnualRevenue)} hint="At your current price and occupancy" />
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs font-medium text-slate-500">Where you stand</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {ev.you?.pricePercentile != null ? `Pricier than ${pct(ev.you.pricePercentile)}` : "—"}
                </p>
                <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-slate-400" />
                  Your rating {ev.you?.rating?.toFixed(2) ?? "—"} vs market {ev.market?.medianRating?.toFixed(2) ?? "—"}
                </p>
                <p className="text-xs text-slate-400 mt-1">of {ev.market?.compCount ?? 0} similar homes ({describeCriteria(ev.criteria)})</p>
              </div>
            </div>

            <Card>
              <CardHeader className="flex-wrap gap-3">
                <CardTitle className="text-base">Nightly rates, next 8 weeks</CardTitle>
                <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                  {(["weekend", "weekday"] as const).map((k) => (
                    <button key={k} onClick={() => setKind(k)}
                      className={`px-3 py-1 rounded-md text-xs font-medium ${kind === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
                      {k === "weekend" ? "Weekends (Fri–Sun)" : "Weekdays (Tue–Thu)"}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <div className="flex flex-wrap gap-4 mb-3 text-xs text-slate-600">
                <span className="flex items-center gap-1.5"><span className="w-4 h-3 rounded-sm" style={{ background: C_MARKET, opacity: 0.2 }} />Market middle half</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-0.5" style={{ background: C_MARKET }} />Market median</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: C_YOU }} />Your price</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: C_SUGGESTED }} />Suggested</span>
              </div>
              <RatesChart windows={windows} />
              <p className="text-xs text-slate-400 mt-2">
                Guest-paid price per night: Airbnb&apos;s total for a 2-night stay including cleaning and service fees,
                before taxes. No orange dot means your home is booked or blocked those nights.
              </p>
            </Card>

            <Card padding="none">
              <CardHeader className="p-5 pb-0"><CardTitle className="text-base">Rate check by date</CardTitle></CardHeader>
              <div className="overflow-x-auto p-5 pt-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      <th className="py-2 pr-4 font-medium">Stay</th>
                      <th className="py-2 pr-4 font-medium">Market range</th>
                      <th className="py-2 pr-4 font-medium">Similar homes booked</th>
                      <th className="py-2 pr-4 font-medium">Your price</th>
                      <th className="py-2 pr-4 font-medium">Suggested</th>
                      <th className="py-2 font-medium">Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {windows.map((w) => (
                      <tr key={w.checkin} className="border-b border-slate-50 align-top">
                        <td className="py-2.5 pr-4 text-slate-900 whitespace-nowrap">{day(w.checkin)}</td>
                        <td className="py-2.5 pr-4 text-slate-700 whitespace-nowrap">{money(w.p25)}–{money(w.p75)}<span className="text-slate-400"> · {money(w.median)} mid</span></td>
                        <td className="py-2.5 pr-4 text-slate-700">{pct(w.marketBookedPct)}</td>
                        <td className="py-2.5 pr-4 text-slate-900 font-medium">{w.yourAvailable === false ? "—" : money(w.yourPrice)}</td>
                        <td className="py-2.5 pr-4">
                          <p className="text-slate-900 font-medium">{money(w.suggested)}</p>
                          <p className="text-xs text-slate-500 max-w-[220px]">{w.suggestionNote}</p>
                        </td>
                        <td className="py-2.5 whitespace-nowrap"><Verdict w={w} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card padding="none">
              <CardHeader className="p-5 pb-0">
                <CardTitle className="text-base">Similar homes ({ev.comps.length})</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto p-5 pt-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      <th className="py-2 pr-4 font-medium">Home</th>
                      <th className="py-2 pr-4 font-medium">Rating</th>
                      <th className="py-2 pr-4 font-medium">Distance</th>
                      <th className="py-2 pr-4 font-medium">Weekend</th>
                      <th className="py-2 pr-4 font-medium">Weekday</th>
                      <th className="py-2 pr-4 font-medium">{ev.historyDays >= 30 ? "Occupancy" : "Booked next 30d"}</th>
                      <th className="py-2 font-medium">Est. monthly revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ev.you && (
                      <tr className="border-b border-slate-100 bg-orange-50/40">
                        <td className="py-2.5 pr-4 font-semibold text-slate-900">{ev.propertyName} (you)</td>
                        <td className="py-2.5 pr-4 text-slate-700">{ev.you.rating?.toFixed(2) ?? "—"}{ev.you.reviews ? ` (${ev.you.reviews})` : ""}</td>
                        <td className="py-2.5 pr-4 text-slate-400">—</td>
                        <td className="py-2.5 pr-4 text-slate-900">{money(ev.you.weekendAvg)}</td>
                        <td className="py-2.5 pr-4 text-slate-900">{money(ev.you.weekdayAvg)}</td>
                        <td className="py-2.5 pr-4 text-slate-900">{pct(ev.you.occupancy30 ?? ev.you.bookedAhead30)}</td>
                        <td className="py-2.5 text-slate-900">{ev.you.estAnnualRevenue != null ? money(ev.you.estAnnualRevenue / 12) : "—"}</td>
                      </tr>
                    )}
                    {ev.comps.map((c) => (
                      <tr key={c.listingId} className="border-b border-slate-50">
                        <td className="py-2.5 pr-4">
                          <a href={`https://www.airbnb.com/rooms/${c.listingId}`} target="_blank" rel="noreferrer"
                            className="text-slate-900 hover:text-blue-700 hover:underline inline-flex items-start gap-1 max-w-[260px]">
                            <span className="truncate">{c.name ?? `Listing ${c.listingId}`}</span>
                            <ExternalLink className="w-3 h-3 mt-1 flex-shrink-0 text-slate-400" />
                          </a>
                          <p className="text-xs text-slate-500">
                            {[c.bedrooms && `${c.bedrooms} bd`, c.beds && `${c.beds} beds`, c.baths && `${c.baths} ba`].filter(Boolean).join(" · ")}
                          </p>
                        </td>
                        <td className="py-2.5 pr-4 text-slate-700 whitespace-nowrap">{c.rating?.toFixed(2) ?? "New"}{c.reviews ? ` (${c.reviews})` : ""}</td>
                        <td className="py-2.5 pr-4 text-slate-700 whitespace-nowrap">{c.distanceMiles} mi</td>
                        <td className="py-2.5 pr-4 text-slate-700">{money(c.weekendNightly)}</td>
                        <td className="py-2.5 pr-4 text-slate-700">{money(c.weekdayNightly)}</td>
                        <td className="py-2.5 pr-4 text-slate-700">{pct(c.occupancy30 ?? c.bookedAhead30)}</td>
                        <td className="py-2.5 text-slate-700">{money(c.estMonthlyRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">How these numbers are estimated</CardTitle></CardHeader>
              <ul className="space-y-2 text-sm text-slate-600 list-disc pl-5">
                <li>Every morning the app searches Airbnb for whole homes like yours ({describeCriteria(ev.criteria)}) for Friday–Sunday and Tuesday–Thursday stays over the next 8 weeks, and records each home&apos;s price. The search starts at 6 miles and widens to 12 when fewer than 15 similar homes turn up.</li>
                <li>It also saves each home&apos;s availability calendar. A night that was open and later shows as taken is counted as booked. Runs of 21+ blocked nights are treated as the owner blocking the calendar and left out.</li>
                <li>Suggested rates start at the market median and move up when most similar homes are already booked or your rating beats theirs, and down when demand is soft.</li>
                <li>Revenue = average nightly price × occupancy. Prices include cleaning and Airbnb&apos;s guest fee, so your actual payout is lower. VRBO isn&apos;t included because it blocks automated collection.</li>
              </ul>
              <p className="text-xs text-slate-400 mt-3">
                History since {ev.firstCapturedOn ? day(ev.firstCapturedOn, "MMM d, yyyy") : "—"} · last prices {ev.lastCapturedOn ? day(ev.lastCapturedOn, "MMM d") : "—"}
              </p>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
