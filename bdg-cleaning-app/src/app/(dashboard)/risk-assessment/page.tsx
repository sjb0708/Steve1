"use client"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { Card, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Textarea } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { formatDateTime } from "@/lib/utils"
import {
  RISK_CATEGORIES,
  type RiskAssessmentResult, type RiskFinding, type OverallRisk, type Severity,
} from "@/lib/risk-assessment-types"
import {
  ShieldCheck, Download, Save, Play, AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Copy, Check, ExternalLink, KeyRound, Scale, HelpCircle, History, FileText,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

type Assessment = {
  id: string
  status: "RUNNING" | "COMPLETE" | "FAILED"
  overallRisk: OverallRisk | null
  score: number | null
  result: RiskAssessmentResult | null
  error: string | null
  costUsd: number | null
  createdAt: string
  completedAt: string | null
}

type PropertyRow = {
  id: string
  name: string
  address: string
  city: string
  state: string
  airbnbListingText: string | null
  airbnbListingPulledAt: string | null
  vrboListingText: string | null
  otherPolicies: string | null
  canPullAirbnb: boolean
  onAirbnb: boolean
  onVrbo: boolean
  riskAssessments: Assessment[]
}

const OVERALL_STYLE: Record<OverallRisk, { label: string; chip: string; ring: string }> = {
  LOW: { label: "Low risk", chip: "bg-emerald-100 text-emerald-800", ring: "border-emerald-200 bg-emerald-50/50" },
  MODERATE: { label: "Moderate risk", chip: "bg-amber-100 text-amber-800", ring: "border-amber-200 bg-amber-50/50" },
  ELEVATED: { label: "Elevated risk", chip: "bg-orange-100 text-orange-800", ring: "border-orange-200 bg-orange-50/50" },
  HIGH: { label: "High risk", chip: "bg-red-100 text-red-800", ring: "border-red-200 bg-red-50/50" },
}

const SEVERITY_STYLE: Record<Severity, { label: string; chip: string; bar: string }> = {
  HIGH: { label: "High", chip: "bg-red-100 text-red-700", bar: "bg-red-500" },
  MEDIUM: { label: "Medium", chip: "bg-amber-100 text-amber-700", bar: "bg-amber-400" },
  LOW: { label: "Low", chip: "bg-blue-100 text-blue-700", bar: "bg-blue-400" },
}

function FindingCard({ finding }: { finding: RiskFinding }) {
  const [open, setOpen] = useState(finding.severity === "HIGH")
  const [copied, setCopied] = useState(false)
  const sev = SEVERITY_STYLE[finding.severity]

  async function copy() {
    try {
      await navigator.clipboard.writeText(finding.suggestedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked; the text is still selectable
    }
  }

  return (
    <div className="relative border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${sev.bar}`} />
      <button onClick={() => setOpen(!open)} className="w-full flex items-start gap-3 p-4 pl-5 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${sev.chip}`}>{sev.label}</span>
            <span className="text-xs text-slate-500">{RISK_CATEGORIES[finding.category]}</span>
          </div>
          <p className="text-sm font-semibold text-slate-900">{finding.title}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 mt-1" /> : <ChevronDown className="w-4 h-4 text-slate-400 mt-1" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3 text-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">The issue</p>
            <p className="text-slate-700 whitespace-pre-line">{finding.issue}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Why it matters</p>
            <p className="text-slate-700 whitespace-pre-line">{finding.whyItMatters}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">What to do</p>
            <p className="text-slate-900 whitespace-pre-line">{finding.recommendation}</p>
          </div>
          {finding.suggestedText && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Suggested wording</p>
                <button onClick={copy} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                  {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </button>
              </div>
              <p className="text-slate-800 whitespace-pre-line">{finding.suggestedText}</p>
            </div>
          )}
          {finding.sources.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Sources</p>
              <ul className="space-y-1">
                {finding.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer"
                      className="inline-flex items-start gap-1 text-blue-600 hover:text-blue-700 hover:underline break-all">
                      <ExternalLink className="w-3 h-3 mt-1 flex-shrink-0" /> {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ListSection({ title, icon: Icon, items, tone }: {
  title: string
  icon: typeof CheckCircle2
  items: string[]
  tone: string
}) {
  if (!items.length) return null
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className={`w-4 h-4 ${tone}`} /> {title}</CardTitle></CardHeader>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-slate-700 flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Report({ assessment }: { assessment: Assessment }) {
  const r = assessment.result
  if (!r) return null
  const style = OVERALL_STYLE[r.overallRisk]
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 }
  for (const f of r.findings) counts[f.severity]++
  const ordered = [...r.findings].sort(
    (a, b) => ["HIGH", "MEDIUM", "LOW"].indexOf(a.severity) - ["HIGH", "MEDIUM", "LOW"].indexOf(b.severity),
  )

  return (
    <div className="space-y-5">
      <Card className={style.ring}>
        <div className="flex flex-wrap items-start gap-5">
          <div className="text-center">
            <p className="text-4xl font-bold text-slate-900 leading-none">{r.score}</p>
            <p className="text-xs text-slate-500 mt-1">risk score / 100</p>
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`px-2.5 py-1 text-sm font-semibold rounded-full ${style.chip}`}>{style.label}</span>
              <span className="text-xs text-slate-500">
                {formatDateTime(assessment.completedAt ?? assessment.createdAt)}
                {assessment.costUsd != null && ` · about $${assessment.costUsd.toFixed(2)}`}
              </span>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{r.summary}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {(["HIGH", "MEDIUM", "LOW"] as const).map((s) => (
                <span key={s} className={`px-2 py-0.5 text-xs font-semibold rounded-full ${SEVERITY_STYLE[s].chip}`}>
                  {counts[s]} {SEVERITY_STYLE[s].label.toLowerCase()}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {r.jurisdictionNotes && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Scale className="w-4 h-4 text-blue-600" /> Rules that apply here</CardTitle></CardHeader>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{r.jurisdictionNotes}</p>
        </Card>
      )}

      <div>
        <h2 className="text-sm font-bold text-slate-900 mb-3">Findings ({r.findings.length})</h2>
        <div className="space-y-2">
          {ordered.map((f, i) => <FindingCard key={i} finding={f} />)}
        </div>
      </div>

      <ListSection title="Airbnb vs VRBO differences" icon={FileText} items={r.platformGaps} tone="text-purple-600" />
      <ListSection title="What you're doing well" icon={CheckCircle2} items={r.strengths} tone="text-emerald-600" />
      <ListSection title="Information to add for a fuller review" icon={AlertCircle} items={r.missingInformation} tone="text-amber-600" />
      <ListSection title="Questions for your attorney" icon={HelpCircle} items={r.attorneyQuestions} tone="text-blue-600" />

      <p className="text-xs text-slate-400 leading-relaxed">
        This is an AI-generated risk review based on public sources and the listing text above. It is not legal
        advice. Confirm licensing, tax, and ordinance requirements with a Florida attorney or the agency named
        before relying on them.
      </p>
    </div>
  )
}

export default function RiskAssessmentPage() {
  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [aiKeySet, setAiKeySet] = useState(true)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)

  const [texts, setTexts] = useState({ airbnbListingText: "", vrboListingText: "", otherPolicies: "" })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [showAirbnb, setShowAirbnb] = useState(false)
  const [sourceMsg, setSourceMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [starting, setStarting] = useState(false)
  const [runError, setRunError] = useState("")

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/risk-assessments")
      if (!res.ok) return
      const d = await res.json()
      setProperties(d.properties ?? [])
      setAiKeySet(!!d.aiKeySet)
      setSelectedId((cur) => cur ?? d.properties?.[0]?.id ?? null)
    } catch {
      // keep what's on screen
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const property = properties.find((p) => p.id === selectedId) ?? null
  const running = property?.riskAssessments.find((a) => a.status === "RUNNING") ?? null

  // Load the source text only when switching properties, so polling for a
  // running assessment never overwrites what's being typed.
  useEffect(() => {
    const p = properties.find((x) => x.id === selectedId)
    if (!p) return
    setTexts({
      airbnbListingText: p.airbnbListingText ?? "",
      vrboListingText: p.vrboListingText ?? "",
      otherPolicies: p.otherPolicies ?? "",
    })
    setDirty(false)
    setSourceMsg(null)
    setRunError("")
    setViewingId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, loading])

  useEffect(() => {
    if (!running) return
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [running, load])

  function edit(field: keyof typeof texts, value: string) {
    setTexts((t) => ({ ...t, [field]: value }))
    setDirty(true)
  }

  function applyListing(listing: Partial<PropertyRow>) {
    setProperties((ps) => ps.map((p) => (p.id === selectedId ? { ...p, ...listing } : p)))
  }

  async function saveSources() {
    if (!property) return
    setSaving(true)
    setSourceMsg(null)
    try {
      const res = await fetch(`/api/properties/${property.id}/listing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(texts),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSourceMsg({ ok: false, text: d.error ?? "Couldn't save." })
        return
      }
      applyListing(d.listing)
      setDirty(false)
      setSourceMsg({ ok: true, text: "Saved." })
    } catch {
      setSourceMsg({ ok: false, text: "Couldn't save. Please try again." })
    } finally {
      setSaving(false)
    }
  }

  async function pullAirbnb() {
    if (!property) return
    setPulling(true)
    setSourceMsg(null)
    try {
      const res = await fetch(`/api/properties/${property.id}/listing`, { method: "POST" })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSourceMsg({ ok: false, text: d.error ?? "Couldn't pull the Airbnb listing." })
        return
      }
      applyListing(d.listing)
      setTexts((t) => ({ ...t, airbnbListingText: d.listing.airbnbListingText ?? "" }))
      setShowAirbnb(true)
      setSourceMsg({ ok: true, text: "Pulled the latest Airbnb listing." })
    } catch {
      setSourceMsg({ ok: false, text: "Couldn't pull the Airbnb listing. Please try again." })
    } finally {
      setPulling(false)
    }
  }

  async function runAssessment() {
    if (!property) return
    setRunError("")
    setStarting(true)
    try {
      if (dirty) await saveSources()
      const res = await fetch("/api/risk-assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: property.id }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRunError(d.error ?? "Couldn't start the assessment.")
        return
      }
      setViewingId(null)
      await load()
    } catch {
      setRunError("Couldn't start the assessment. Please try again.")
    } finally {
      setStarting(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>
  }

  const history = property?.riskAssessments ?? []
  const latestDone = history.find((a) => a.status !== "RUNNING") ?? null
  const shown = (viewingId && history.find((a) => a.id === viewingId)) || latestDone
  const hasSource = !!(texts.airbnbListingText.trim() || texts.vrboListingText.trim())

  return (
    <div className="min-h-screen">
      <Header title="Risk Assessment" subtitle="AI review of house rules, listings, and legal compliance" />

      <div className="p-4 sm:p-6 max-w-3xl space-y-6">
        {!aiKeySet && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <KeyRound className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">Add your Claude API key to run assessments</p>
              <p className="mt-0.5">
                Paste it in <Link href="/settings?tab=ai" className="font-semibold underline">Settings → AI Assistant</Link>.
                You can pull and paste listings below in the meantime.
              </p>
            </div>
          </div>
        )}

        {properties.length === 0 ? (
          <p className="text-center text-slate-500 py-20">No properties yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {properties.map((p) => {
                const last = p.riskAssessments.find((a) => a.status === "COMPLETE")
                return (
                  <button key={p.id} onClick={() => setSelectedId(p.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      p.id === selectedId ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}>
                    {p.name}
                    {last?.overallRisk && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${OVERALL_STYLE[last.overallRisk].chip}`}>
                        {last.score}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {property && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">What gets reviewed</CardTitle>
                  </CardHeader>
                  <div className="space-y-5">
                    {/* Airbnb */}
                    <div className="p-4 rounded-2xl border border-slate-100">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Airbnb listing &amp; house rules</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {property.airbnbListingPulledAt
                              ? `Pulled ${formatDistanceToNow(new Date(property.airbnbListingPulledAt), { addSuffix: true })}`
                              : texts.airbnbListingText
                                ? "Entered by hand"
                                : property.canPullAirbnb ? "Not pulled yet" : "No Airbnb calendar link on this property"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {texts.airbnbListingText && (
                            <Button size="sm" variant="ghost" onClick={() => setShowAirbnb(!showAirbnb)}>
                              {showAirbnb ? "Hide" : "View / edit"}
                            </Button>
                          )}
                          {property.canPullAirbnb && (
                            <Button size="sm" variant="outline" onClick={pullAirbnb} loading={pulling}>
                              {!pulling && <Download className="w-4 h-4" />}
                              {property.airbnbListingPulledAt ? "Pull again" : "Pull from Airbnb"}
                            </Button>
                          )}
                        </div>
                      </div>
                      {(showAirbnb || (!property.canPullAirbnb && property.onAirbnb)) && (
                        <div className="mt-3">
                          <Textarea rows={10} value={texts.airbnbListingText}
                            placeholder="Paste the Airbnb description and house rules here"
                            onChange={(e) => edit("airbnbListingText", e.target.value)} />
                        </div>
                      )}
                    </div>

                    {/* VRBO */}
                    <div className="p-4 rounded-2xl border border-slate-100">
                      <p className="text-sm font-semibold text-slate-900">VRBO listing &amp; house rules</p>
                      <p className="text-xs text-slate-500 mt-0.5 mb-3">
                        VRBO blocks automatic pulls. Open the listing, copy the description, house rules, and
                        policies, and paste them here. Update it when you change the listing.
                      </p>
                      <Textarea rows={6} value={texts.vrboListingText}
                        placeholder={property.onVrbo ? "Paste the VRBO description, house rules, and policies" : "Not listed on VRBO. Leave blank."}
                        onChange={(e) => edit("vrboListingText", e.target.value)} />
                    </div>

                    {/* Other */}
                    <div className="p-4 rounded-2xl border border-slate-100">
                      <p className="text-sm font-semibold text-slate-900">Other documents (optional)</p>
                      <p className="text-xs text-slate-500 mt-0.5 mb-3">
                        Anything else worth weighing: rental agreement, state license and tax account numbers,
                        insurance policy type, HOA rules, pool fencing or alarms.
                      </p>
                      <Textarea rows={4} value={texts.otherPolicies}
                        placeholder="e.g. DBPR vacation rental license #…, Proper short-term rental insurance, pool has self-latching gate"
                        onChange={(e) => edit("otherPolicies", e.target.value)} />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button size="sm" variant="outline" onClick={saveSources} loading={saving} disabled={!dirty}>
                        {!saving && <Save className="w-4 h-4" />} Save
                      </Button>
                      {sourceMsg && (
                        <p className={`text-sm flex items-center gap-1.5 ${sourceMsg.ok ? "text-emerald-700" : "text-red-600"}`}>
                          {sourceMsg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                          {sourceMsg.text}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Run a risk assessment</p>
                        <p className="text-xs text-slate-500 mt-0.5 max-w-md">
                          Claude researches current Florida, county, and city rules plus Airbnb and VRBO policy,
                          then reviews everything above. Takes a few minutes; usually under $2.
                        </p>
                      </div>
                    </div>
                    <Button onClick={runAssessment} loading={starting}
                      disabled={!!running || !aiKeySet || !hasSource}>
                      {!starting && <Play className="w-4 h-4" />} {running ? "Running…" : "Run assessment"}
                    </Button>
                  </div>
                  {!hasSource && (
                    <p className="text-xs text-slate-500 mt-3">Pull the Airbnb listing or paste the VRBO listing first.</p>
                  )}
                  {runError && (
                    <p className="text-sm text-red-600 mt-3 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {runError}</p>
                  )}
                  {running && (
                    <div className="mt-4 p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-center gap-3">
                      <Spinner size="sm" />
                      <p className="text-sm text-blue-900">
                        Researching and reviewing. Started {formatDistanceToNow(new Date(running.createdAt), { addSuffix: true })}.
                        You can leave this page; the results will be here when you come back.
                      </p>
                    </div>
                  )}
                </Card>

                {shown?.status === "FAILED" && (
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-800">
                      <p className="font-semibold">The assessment from {formatDateTime(shown.createdAt)} didn&apos;t finish</p>
                      <p className="mt-0.5">{shown.error}</p>
                    </div>
                  </div>
                )}

                {shown?.status === "COMPLETE" && <Report assessment={shown} />}

                {history.filter((a) => a.status !== "RUNNING").length > 1 && (
                  <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="w-4 h-4 text-slate-500" /> Past assessments</CardTitle></CardHeader>
                    <div className="divide-y divide-slate-100">
                      {history.filter((a) => a.status !== "RUNNING").map((a) => (
                        <button key={a.id} onClick={() => setViewingId(a.id)}
                          className={`w-full flex items-center justify-between gap-3 py-2.5 text-left text-sm hover:bg-slate-50 px-2 rounded-lg ${
                            shown?.id === a.id ? "bg-slate-50" : ""
                          }`}>
                          <span className="text-slate-700">{formatDateTime(a.createdAt)}</span>
                          {a.status === "COMPLETE" && a.overallRisk ? (
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${OVERALL_STYLE[a.overallRisk].chip}`}>
                              {OVERALL_STYLE[a.overallRisk].label} · {a.score}
                            </span>
                          ) : (
                            <span className="text-xs text-red-600">Didn&apos;t finish</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
