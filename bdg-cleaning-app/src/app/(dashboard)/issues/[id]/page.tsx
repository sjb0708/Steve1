"use client"
import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Card, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import { Avatar } from "@/components/ui/Avatar"
import { formatDateTime } from "@/lib/utils"
import { TriangleAlert, ArrowLeft, Building2, Calendar, CheckCircle2, Clock, X, DollarSign, Copy, Check, ShieldCheck, Printer } from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import type { IssueReport } from "@/types"

const TYPE_LABELS: Record<string, string> = {
  DAMAGE: "Damage", BROKEN_ITEM: "Broken Item", STAIN: "Stain", PEST: "Pest", OTHER: "Other",
}
const SEVERITY_CONFIG: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  MEDIUM: { label: "Medium", className: "bg-amber-100 text-amber-700 border-amber-200" },
  HIGH: { label: "High", className: "bg-red-100 text-red-700 border-red-200" },
}
const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "RESOLVED", label: "Resolved" },
]

// Types a host could plausibly file with Airbnb — mirrors the cleaner-side
// attestation gate in the Report Issue modal.
const AIRBNB_CLAIMABLE_TYPES = new Set(["DAMAGE", "BROKEN_ITEM", "STAIN", "PEST"])

// Airbnb requires filing in the Resolution Center within 14 days of the
// responsible guest's checkout (job.scheduledDate is that checkout date) —
// or before the next guest checks in, whichever is sooner. This tracks only
// the 14-day rule, since the app doesn't know the next booking's check-in.
const AIRBNB_FILING_WINDOW_DAYS = 14

function daysLeftToFile(checkoutDate: string): number {
  const deadline = new Date(checkoutDate).getTime() + AIRBNB_FILING_WINDOW_DAYS * 24 * 60 * 60 * 1000
  return Math.ceil((deadline - Date.now()) / (24 * 60 * 60 * 1000))
}

export default function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [issue, setIssue] = useState<IssueReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/issues/${id}`)
      .then((r) => r.json())
      .then((d) => setIssue(d.issue ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  async function updateStatus(status: string) {
    if (!issue) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/issues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) setIssue((prev) => prev ? { ...prev, status: status as IssueReport["status"] } : prev)
    } finally {
      setUpdating(false)
    }
  }

  async function copyForAirbnb() {
    if (!issue) return
    const lines = [
      `Property: ${issue.property?.name ?? ""}${issue.property?.address ? ` — ${issue.property.address}, ${issue.property.city}, ${issue.property.state}` : ""}`,
      issue.job ? `Guest checkout date: ${formatDateTime(issue.job.scheduledDate)}` : null,
      `Type: ${TYPE_LABELS[issue.type] ?? issue.type}`,
      `Severity: ${SEVERITY_CONFIG[issue.severity]?.label ?? issue.severity}`,
      `Description: ${issue.description}`,
      issue.estimatedCost ? `Estimated repair/replacement cost: $${issue.estimatedCost.toFixed(2)}` : null,
      issue.reportedBy ? `Reported by: ${issue.reportedBy.name} on ${formatDateTime(issue.createdAt)}` : null,
      `Photos confirmed original by reporter: ${issue.photosConfirmedOriginal ? "Yes" : "No"}`,
      issue.photos?.length ? `Photos:\n${issue.photos.map((p) => p.url).join("\n")}` : null,
    ].filter(Boolean)

    await navigator.clipboard.writeText(lines.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen">
      <Header
        title="Issue Report"
        subtitle={issue?.property?.name ?? "Loading…"}
        actions={
          <Link href="/issues">
            <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4" /> Back</Button>
          </Link>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center min-h-64"><Spinner size="lg" /></div>
      ) : !issue ? (
        <div className="flex flex-col items-center justify-center min-h-64 text-slate-500">
          <TriangleAlert className="w-12 h-12 mb-4 text-slate-200" />
          <p>Issue not found</p>
        </div>
      ) : (
        <div className="p-6 max-w-4xl">
          {/* Airbnb 14-day filing deadline — only meaningful for claimable types */}
          {issue.job && AIRBNB_CLAIMABLE_TYPES.has(issue.type) && (() => {
            const daysLeft = daysLeftToFile(issue.job.scheduledDate)
            const expired = daysLeft < 0
            const urgent = daysLeft >= 0 && daysLeft <= 3
            return (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
                <div className={`flex items-center gap-3 rounded-2xl p-4 border ${
                  expired ? "bg-slate-100 border-slate-200" : urgent ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                }`}>
                  <Clock className={`w-5 h-5 flex-shrink-0 ${expired ? "text-slate-400" : urgent ? "text-red-600" : "text-amber-600"}`} />
                  <div>
                    <p className={`text-sm font-semibold ${expired ? "text-slate-600" : urgent ? "text-red-900" : "text-amber-900"}`}>
                      {expired
                        ? "Airbnb's 14-day filing window has closed"
                        : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left to file with Airbnb`}
                    </p>
                    <p className={`text-xs mt-0.5 ${expired ? "text-slate-500" : urgent ? "text-red-700" : "text-amber-700"}`}>
                      {expired
                        ? "Reimbursement requests must be filed within 14 days of guest checkout."
                        : "File in the Resolution Center within 14 days of guest checkout, or before your next guest checks in — whichever is sooner."}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })()}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main */}
            <div className="lg:col-span-2 space-y-5">
              {/* Summary card */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <TriangleAlert className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${SEVERITY_CONFIG[issue.severity]?.className}`}>
                            {SEVERITY_CONFIG[issue.severity]?.label} Severity
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                            {TYPE_LABELS[issue.type] ?? issue.type}
                          </span>
                          {issue.photosConfirmedOriginal && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                              <ShieldCheck className="w-3 h-3" /> Photos confirmed original
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{formatDateTime(issue.createdAt)}</p>
                      </div>
                    </div>
                  </div>

                  {issue.estimatedCost ? (
                    <div className="flex items-center gap-2 mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <DollarSign className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <p className="text-sm text-emerald-900">
                        Estimated cost: <span className="font-bold">${issue.estimatedCost.toFixed(2)}</span>
                      </p>
                    </div>
                  ) : null}

                  <div className="mb-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</p>
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{issue.description}</p>
                  </div>

                  {AIRBNB_CLAIMABLE_TYPES.has(issue.type) && (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={copyForAirbnb}>
                        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        {copied ? "Copied!" : "Copy for Airbnb Resolution Center"}
                      </Button>
                      <Link href={`/issues/${issue.id}/print`} target="_blank">
                        <Button type="button" variant="outline" size="sm">
                          <Printer className="w-4 h-4" /> Print Report / Save as PDF
                        </Button>
                      </Link>
                    </div>
                  )}
                </Card>
              </motion.div>

              {/* Photos */}
              {issue.photos?.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <Card>
                    <CardHeader><CardTitle>Photos ({issue.photos.length})</CardTitle></CardHeader>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                      {issue.photos.map((photo) => (
                        <button
                          key={photo.id}
                          onClick={() => setLightbox(photo.url)}
                          className="aspect-square rounded-xl overflow-hidden border border-slate-200 hover:border-blue-400 transition-all hover:shadow-md"
                        >
                          <img src={photo.url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              {/* Status */}
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                <Card>
                  <p className="text-sm font-semibold text-slate-500 mb-3">Status</p>
                  <div className="space-y-2">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateStatus(opt.value)}
                        disabled={updating || issue.status === opt.value}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          issue.status === opt.value
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 disabled:opacity-50"
                        }`}
                      >
                        {updating && issue.status !== opt.value ? (
                          <Spinner size="sm" />
                        ) : opt.value === "RESOLVED" ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : opt.value === "REVIEWED" ? (
                          <Clock className="w-4 h-4" />
                        ) : (
                          <TriangleAlert className="w-4 h-4" />
                        )}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </Card>
              </motion.div>

              {/* Reported by */}
              {issue.reportedBy && (
                <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                  <Card>
                    <p className="text-sm font-semibold text-slate-500 mb-3">Reported By</p>
                    <div className="flex items-center gap-3">
                      <Avatar name={issue.reportedBy.name} src={issue.reportedBy.avatarUrl} size="md" />
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{issue.reportedBy.name}</p>
                        {issue.reportedBy.phone && (
                          <p className="text-xs text-slate-500">{issue.reportedBy.phone}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}

              {/* Property & Job */}
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                <Card>
                  <p className="text-sm font-semibold text-slate-500 mb-3">Details</p>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="font-medium">{issue.property?.name}</span>
                    </div>
                    {issue.job && (
                      <div className="flex items-center gap-2 text-slate-700">
                        <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span>Job on {formatDateTime(issue.job.scheduledDate)}</span>
                      </div>
                    )}
                    <Link
                      href={`/jobs/${issue.jobId}`}
                      className="block text-xs text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      View job →
                    </Link>
                  </div>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <button className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              src={lightbox}
              alt=""
              className="max-w-full max-h-full rounded-xl object-contain shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
