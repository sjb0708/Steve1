"use client"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/components/layout/Providers"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Spinner } from "@/components/ui/Spinner"
import { Modal } from "@/components/ui/Modal"
import { Select } from "@/components/ui/Select"
import { Input } from "@/components/ui/Input"
import { formatDateTime, formatDateShort, formatTime, STATUS_COLORS, STATUS_LABELS } from "@/lib/utils"
import type { Job, User, Property } from "@/types"
import {
  Calendar, Clock, MapPin, Search, Plus, Building2,
  AlertCircle, ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

type StatusFilter = "ALL" | "UNASSIGNED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "ALL" },
  { label: "Unassigned", value: "UNASSIGNED" },
  { label: "Assigned", value: "ASSIGNED" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
]

const stagger = { visible: { transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }

// ─── Create Job Modal ─────────────────────────────────────────────────────────

interface CreateJobModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

function CreateJobModal({ open, onClose, onCreated }: CreateJobModalProps) {
  const [cleaners, setCleaners] = useState<User[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [propertyId, setPropertyId] = useState("")
  const [cleanerId, setCleanerId] = useState("")
  const [scheduledDate, setScheduledDate] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch("/api/users?role=CLEANER&approved=true").then((r) => r.json()),
      fetch("/api/properties").then((r) => r.json()),
    ]).then(([ud, pd]) => {
      setCleaners(ud.users ?? ud)
      setProperties(pd.properties ?? pd)
    }).catch(() => {})
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!propertyId || !scheduledDate) {
      setError("Please select a property and scheduled date.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          scheduledDate,
          cleanerId: cleanerId || undefined,
          notes: notes || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? "Failed to create job.")
        return
      }
      onCreated()
      onClose()
    } catch {
      setError("Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Job" description="Schedule a new cleaning job">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <Select
          label="Property"
          placeholder="Select a property..."
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          options={properties.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Input
          label="Scheduled Date & Time"
          type="datetime-local"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
          required
        />
        <Select
          label="Assign Cleaner (optional)"
          placeholder="Select a cleaner..."
          value={cleanerId}
          onChange={(e) => setCleanerId(e.target.value)}
          options={cleaners.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Input
          label="Notes (optional)"
          placeholder="Special instructions..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> {error}
          </p>
        )}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={submitting}>
            {submitting ? <Spinner size="sm" /> : "Create Job"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Admin jobs list ──────────────────────────────────────────────────────────

function AdminJobsView() {
  const searchParams = useSearchParams()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>("ALL")
  const [search, setSearch] = useState("")
  const [showCreate, setShowCreate] = useState(false)

  // Pre-filter by propertyId from URL (e.g. from property detail page)
  const propertyIdParam = searchParams.get("propertyId")

  async function loadJobs() {
    try {
      const res = await fetch("/api/jobs")
      if (res.ok) {
        const data = await res.json()
        setJobs(data.jobs ?? data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadJobs() }, [])

  const filtered = jobs.filter((j) => {
    if (propertyIdParam && j.property?.id !== propertyIdParam) return false
    if (filter !== "ALL" && j.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      const name = j.property?.name?.toLowerCase() ?? ""
      const cleaner = j.cleaner?.name?.toLowerCase() ?? ""
      if (!name.includes(q) && !cleaner.includes(q)) return false
    }
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <>
      <Header
        title="Jobs"
        subtitle={
          propertyIdParam
            ? `${filtered.length} job${filtered.length !== 1 ? "s" : ""} for this property`
            : `${filtered.length} job${filtered.length !== 1 ? "s" : ""}`
        }
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Create Job
          </Button>
        }
      />

      <div className="p-6 max-w-5xl space-y-5">
        {/* Property filter banner */}
        {propertyIdParam && (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm">
            <span className="text-blue-700 font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Filtered by property
            </span>
            <Link href="/jobs" className="text-blue-600 hover:text-blue-700 font-medium text-xs">
              Clear filter →
            </Link>
          </div>
        )}
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by property or cleaner..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-300 transition-all"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  filter === f.value
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Job list */}
        <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-3">
          {filtered.map((job) => (
            <motion.div key={job.id} variants={fadeUp}>
              <Link href={`/jobs/${job.id}`}>
                <Card hover padding="none">
                  <div className="flex items-center gap-4 p-5">
                    {/* Status bar */}
                    <div
                      className={`w-1.5 h-16 rounded-full flex-shrink-0 ${
                        job.status === "COMPLETED"
                          ? "bg-emerald-400"
                          : job.status === "IN_PROGRESS"
                          ? "bg-amber-400"
                          : job.status === "ASSIGNED"
                          ? "bg-blue-400"
                          : job.status === "UNASSIGNED"
                          ? "bg-slate-300"
                          : "bg-red-300"
                      }`}
                    />

                    {/* Property info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            {job.property?.name ?? "Property"}
                          </p>
                          {job.property && (
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {job.property.city}, {job.property.state}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDateTime(job.scheduledDate)}
                        </span>
                        {job.booking && (
                          <span className={`px-2 py-0.5 rounded-full font-medium ${
                            job.booking.platform === "AIRBNB"
                              ? "bg-rose-100 text-rose-700"
                              : job.booking.platform === "VRBO"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {job.booking.platform}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Cleaner */}
                    <div className="hidden sm:flex flex-col items-center gap-1 flex-shrink-0">
                      {job.cleaner ? (
                        <>
                          <Avatar name={job.cleaner.name} size="sm" />
                          <p className="text-xs text-slate-600 font-medium max-w-[80px] truncate text-center">
                            {job.cleaner.name.split(" ")[0]}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                            <span className="text-slate-400 text-xs font-bold">?</span>
                          </div>
                          <p className="text-xs text-slate-400 font-medium">Unassigned</p>
                        </>
                      )}
                    </div>

                    {/* Status badge */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[job.status]}`}>
                        {STATUS_LABELS[job.status]}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-200" />
              <p className="font-medium">No jobs found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          )}
        </motion.div>
      </div>

      <CreateJobModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadJobs}
      />
    </>
  )
}

// ─── Cleaner jobs list ────────────────────────────────────────────────────────

function CleanerJobsView() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>("ALL")

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/jobs")
        if (res.ok) {
          const data = await res.json()
          setJobs(data.jobs ?? data)
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  const filtered = jobs.filter((j) => filter === "ALL" || j.status === filter)

  return (
    <>
      <Header title="My Jobs" subtitle={`${filtered.length} job${filtered.length !== 1 ? "s" : ""}`} />

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { label: "All", value: "ALL" as StatusFilter },
            { label: "Action Required", value: "PENDING_ACCEPTANCE" as StatusFilter },
            { label: "Assigned", value: "ASSIGNED" as StatusFilter },
            { label: "In Progress", value: "IN_PROGRESS" as StatusFilter },
            { label: "Completed", value: "COMPLETED" as StatusFilter },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all min-h-[40px] ${
                filter === f.value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Job cards */}
        <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-3">
          {filtered.map((job) => {
            const items = job.checklistItems ?? []
            const done = items.filter((c) => c.completed).length
            const pct = items.length ? Math.round((done / items.length) * 100) : 0

            return (
              <motion.div key={job.id} variants={fadeUp}>
                <Link href={`/jobs/${job.id}`}>
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm active:scale-[0.99] transition-transform">
                    <div className="p-4">
                      {job.status === "PENDING_ACCEPTANCE" && (
                        <div className="mb-3 flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">
                          <AlertCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
                          <span className="text-xs font-semibold text-purple-700">Action required — tap to accept or decline</span>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 text-base truncate">
                            {job.property?.name ?? "Property"}
                          </p>
                          {job.property && (
                            <p className="text-sm text-slate-500 mt-0.5">
                              {job.property.city}, {job.property.state}
                            </p>
                          )}
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${STATUS_COLORS[job.status]}`}>
                          {STATUS_LABELS[job.status]}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">{formatDateShort(job.scheduledDate)}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-slate-400" />
                          {formatTime(job.scheduledDate)}
                        </span>
                      </div>

                      {items.length > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>Checklist</span>
                            <span className="font-semibold text-slate-700">{done}/{items.length}</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-slate-50 px-4 py-3 flex justify-end">
                      <span className="text-sm font-semibold text-blue-600 flex items-center gap-1">
                        View details <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-200" />
              <p className="font-medium">No jobs here</p>
              <p className="text-sm mt-1">Check back later for new assignments.</p>
            </div>
          )}
        </motion.div>
      </div>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const { user, loading: authLoading } = useAuth()
  const isAdmin = user?.role === "ADMIN"

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {isAdmin ? <AdminJobsView /> : <CleanerJobsView />}
    </div>
  )
}
