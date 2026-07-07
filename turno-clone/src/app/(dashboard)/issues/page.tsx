"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/layout/Providers"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/Card"
import { Spinner } from "@/components/ui/Spinner"
import { Avatar } from "@/components/ui/Avatar"
import { formatDate } from "@/lib/utils"
import { TriangleAlert, CheckCircle2, Clock, Building2, ChevronRight, Camera } from "lucide-react"
import { motion } from "framer-motion"
import type { IssueReport } from "@/types"

const TYPE_LABELS: Record<string, string> = {
  DAMAGE: "Damage",
  BROKEN_ITEM: "Broken Item",
  STAIN: "Stain",
  PEST: "Pest",
  OTHER: "Other",
}

const SEVERITY_CONFIG: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-emerald-100 text-emerald-700" },
  MEDIUM: { label: "Medium", className: "bg-amber-100 text-amber-700" },
  HIGH: { label: "High", className: "bg-red-100 text-red-700" },
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  OPEN: { label: "Open", className: "bg-red-100 text-red-700", icon: <TriangleAlert className="w-3.5 h-3.5" /> },
  REVIEWED: { label: "Reviewed", className: "bg-blue-100 text-blue-700", icon: <Clock className="w-3.5 h-3.5" /> },
  RESOLVED: { label: "Resolved", className: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
}

const FILTERS = ["ALL", "OPEN", "REVIEWED", "RESOLVED"]

export default function IssuesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const isAdmin = user?.role === "ADMIN"
  const [issues, setIssues] = useState<IssueReport[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("ALL")

  useEffect(() => {
    const url = filter === "ALL" ? "/api/issues" : `/api/issues?status=${filter}`
    fetch(url)
      .then((r) => r.json())
      .then((d) => setIssues(d.issues ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter])

  const openCount = issues.filter((i) => i.status === "OPEN").length

  return (
    <div className="min-h-screen">
      <Header
        title={isAdmin ? "Issue Reports" : "My Reports"}
        subtitle={isAdmin ? "Damages and issues reported by your cleaners" : "Issues you've reported on jobs"}
      />

      {loading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : (
        <div className="p-6 max-w-4xl">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Open", value: issues.filter((i) => i.status === "OPEN").length, color: "text-red-600" },
              { label: "Reviewed", value: issues.filter((i) => i.status === "REVIEWED").length, color: "text-blue-600" },
              { label: "Resolved", value: issues.filter((i) => i.status === "RESOLVED").length, color: "text-emerald-600" },
            ].map((s) => (
              <Card key={s.label} className="text-center">
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-sm text-slate-500 mt-1">{s.label}</p>
              </Card>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  filter === f
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {f === "ALL" ? "All" : STATUS_CONFIG[f]?.label ?? f}
              </button>
            ))}
          </div>

          {/* Issues list */}
          {issues.length === 0 ? (
            <Card className="text-center py-12 text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-slate-200" />
              <p className="font-medium">No issues found</p>
              <p className="text-sm mt-1">Cleaners can report issues from any job page</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {issues.map((issue, i) => {
                const severity = SEVERITY_CONFIG[issue.severity]
                const status = STATUS_CONFIG[issue.status]
                return (
                  <motion.div
                    key={issue.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => router.push(`/issues/${issue.id}`)}
                    className="cursor-pointer"
                  >
                    <Card className="hover:border-blue-200 hover:shadow-md transition-all group">
                      <div className="flex items-start gap-4">
                        {/* First photo thumbnail or icon */}
                        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
                          {issue.photos?.[0] ? (
                            <img src={issue.photos[0].url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <TriangleAlert className="w-6 h-6 text-amber-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${status.className}`}>
                              {status.icon} {status.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${severity.className}`}>
                              {severity.label}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                              {TYPE_LABELS[issue.type] ?? issue.type}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-1">
                            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="font-medium text-slate-900 truncate">{issue.property?.name}</span>
                          </div>

                          <p className="text-sm text-slate-600 line-clamp-2">{issue.description}</p>

                          <div className="flex items-center gap-3 mt-2">
                            {issue.reportedBy && (
                              <div className="flex items-center gap-1.5">
                                <Avatar name={issue.reportedBy.name} size="xs" />
                                <span className="text-xs text-slate-500">{issue.reportedBy.name}</span>
                              </div>
                            )}
                            <span className="text-xs text-slate-400">{formatDate(issue.createdAt)}</span>
                            {issue.photos?.length > 0 && (
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Camera className="w-3 h-3" /> {issue.photos.length}
                              </span>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 flex-shrink-0 mt-1 transition-colors" />
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
