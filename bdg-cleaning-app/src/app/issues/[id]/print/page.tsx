"use client"
import { useState, useEffect, use } from "react"
import { Printer, ArrowLeft, ShieldCheck } from "lucide-react"
import Link from "next/link"
import type { IssueReport } from "@/types"

const TYPE_LABELS: Record<string, string> = {
  DAMAGE: "Damage", BROKEN_ITEM: "Broken Item", STAIN: "Stain", PEST: "Pest", OTHER: "Other",
}
const SEVERITY_LABELS: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" }

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  })
}

export default function PrintIssueReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [issue, setIssue] = useState<IssueReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/issues/${id}`)
      .then((r) => r.json())
      .then((d) => setIssue(d.issue ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>
  if (!issue) return <div className="min-h-screen flex items-center justify-center text-slate-400">Report not found</div>

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <Link href={`/issues/${id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Back to Issue
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      {/* Printable document */}
      <div className="max-w-[750px] mx-auto bg-white my-8 print:my-0 p-10 print:p-0 shadow-sm print:shadow-none rounded-2xl print:rounded-none">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Property Damage / Issue Report</h1>
            <p className="text-sm text-slate-500 mt-0.5">Bailey Development Group Cleaning Management</p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>Report ID: {issue.id}</p>
            <p>Generated {fmt(new Date().toISOString())}</p>
          </div>
        </div>

        <table className="w-full text-sm mb-6">
          <tbody>
            <Row label="Property" value={issue.property?.name ?? "—"} />
            {issue.property?.address && (
              <Row label="Address" value={`${issue.property.address}, ${issue.property.city}, ${issue.property.state}`} />
            )}
            {issue.job && <Row label="Guest checkout date" value={fmt(issue.job.scheduledDate)} />}
            <Row label="Issue type" value={TYPE_LABELS[issue.type] ?? issue.type} />
            <Row label="Severity" value={SEVERITY_LABELS[issue.severity] ?? issue.severity} />
            <Row label="Reported by" value={issue.reportedBy?.name ?? "—"} />
            <Row label="Reported at" value={fmt(issue.createdAt)} />
            {issue.estimatedCost ? (
              <Row label="Estimated repair / replacement cost" value={`$${issue.estimatedCost.toFixed(2)}`} bold />
            ) : null}
          </tbody>
        </table>

        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</p>
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap border border-slate-200 rounded-xl p-4 bg-slate-50 print:bg-white">
            {issue.description}
          </p>
        </div>

        {issue.photosConfirmedOriginal && (
          <div className="flex items-center gap-2 mb-6 p-3 bg-emerald-50 print:bg-white border border-emerald-200 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-emerald-900">
              The reporting cleaner confirmed these photos are original, unedited camera captures taken during this visit.
            </p>
          </div>
        )}

        {issue.photos?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Photo Evidence ({issue.photos.length})
            </p>
            <div className="grid grid-cols-2 gap-4">
              {issue.photos.map((photo, i) => (
                <div key={photo.id} className="break-inside-avoid">
                  <img
                    src={photo.url}
                    alt={`Evidence photo ${i + 1}`}
                    className="w-full aspect-[4/3] object-cover rounded-xl border border-slate-200"
                  />
                  <p className="text-xs text-slate-400 mt-1">Photo {i + 1} of {issue.photos.length}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-slate-200 text-xs text-slate-400">
          Prepared for submission to Airbnb's Resolution Center / AirCover Host Damage Protection. Retain original photo files — Airbnb requires unedited, non-AI-generated images as supporting evidence.
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2 pr-4 text-slate-500 align-top w-1/3">{label}</td>
      <td className={`py-2 text-slate-900 ${bold ? "font-bold" : ""}`}>{value}</td>
    </tr>
  )
}
