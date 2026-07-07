"use client"
import { useEffect, useState, use, useRef } from "react"
import { useAuth } from "@/components/layout/Providers"
import { Header } from "@/components/layout/Header"
import { Card, CardHeader, CardTitle } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Button } from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import { Modal } from "@/components/ui/Modal"
import { Select } from "@/components/ui/Select"
import { formatDate, formatDateTime, formatDateShort, formatTime, STATUS_COLORS, STATUS_LABELS } from "@/lib/utils"
import type { Job, User, ChecklistItem } from "@/types"
import {
  Building2, MapPin, Calendar, Clock, CheckCircle2, Circle,
  ArrowLeft, AlertCircle, UserCheck, FileText, ThumbsUp, ThumbsDown,
  TriangleAlert, Camera, X, ImagePlus, DollarSign, ShoppingCart, Package, Truck,
} from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

// ─── Checklist progress bar ───────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
      />
    </div>
  )
}

// ─── Assign cleaner modal (admin) ─────────────────────────────────────────────

interface AssignModalProps {
  open: boolean
  onClose: () => void
  jobId: string
  currentCleanerId?: string | null
  onAssigned: (cleaner: User) => void
}

function AssignCleanerModal({ open, onClose, jobId, currentCleanerId, onAssigned }: AssignModalProps) {
  const [cleaners, setCleaners] = useState<User[]>([])
  const [selectedId, setSelectedId] = useState(currentCleanerId ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    fetch("/api/users?role=CLEANER&approved=true")
      .then((r) => r.json())
      .then((d) => setCleaners(d.users ?? d))
      .catch(() => {})
    setSelectedId(currentCleanerId ?? "")
  }, [open, currentCleanerId])

  async function handleAssign() {
    if (!selectedId) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleanerId: selectedId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? "Failed to assign cleaner.")
        return
      }
      const cleaner = cleaners.find((c) => c.id === selectedId)
      if (cleaner) onAssigned(cleaner)
      onClose()
    } catch {
      setError("Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={currentCleanerId ? "Reassign Cleaner" : "Assign Cleaner"}
      description="Select a cleaner for this job"
    >
      <div className="p-6 space-y-4">
        <Select
          label="Cleaner"
          placeholder="Select a cleaner..."
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          options={cleaners.map((c) => ({ value: c.id, label: c.name }))}
        />
        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> {error}
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" disabled={!selectedId || submitting} onClick={handleAssign}>
            {submitting ? <Spinner size="sm" /> : "Assign"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Admin job detail ─────────────────────────────────────────────────────────

type Payment = { id: string; amount: number; status: string; paidAt: string | null }

type IssueReportSummary = {
  id: string
  type: string
  severity: string
  description: string
  status: string
  createdAt: string
  photos: { id: string; url: string }[]
  reportedBy: { name: string } | null
}

type SupplyRequestSummary = {
  id: string
  items: string
  notes: string | null
  status: string
  createdAt: string
  requestedBy: { name: string } | null
}

const SUPPLY_STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ORDERED: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
}
const SUPPLY_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending", ORDERED: "Ordered", DELIVERED: "Delivered",
}

const ISSUE_TYPE_LABELS: Record<string, string> = {
  DAMAGE: "Damage", BROKEN_ITEM: "Broken Item", STAIN: "Stain", PEST: "Pest", OTHER: "Other",
}
const ISSUE_SEVERITY_CLASS: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-red-100 text-red-700",
}
const ISSUE_STATUS_CLASS: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  REVIEWED: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
}

function AdminJobDetail({ job: initialJob }: { job: Job }) {
  const [job, setJob] = useState(initialJob)
  const [showAssign, setShowAssign] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [markingPaid, setMarkingPaid] = useState(false)
  const [issues, setIssues] = useState<IssueReportSummary[]>([])
  const [supplyRequests, setSupplyRequests] = useState<SupplyRequestSummary[]>([])
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/payments?jobId=${initialJob.id}`)
      .then((r) => r.json())
      .then((d) => setPayment(d.payments?.[0] ?? null))
      .catch(() => {})
    fetch(`/api/issues?jobId=${initialJob.id}`)
      .then((r) => r.json())
      .then((d) => setIssues(d.issues ?? []))
      .catch(() => {})
    fetch(`/api/supply-requests?jobId=${initialJob.id}`)
      .then((r) => r.json())
      .then((d) => setSupplyRequests(d.requests ?? []))
      .catch(() => {})
  }, [initialJob.id])

  async function cancelJob() {
    if (!confirm("Cancel this job?")) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      })
      if (res.ok) setJob((j) => ({ ...j, status: "CANCELLED" }))
    } finally {
      setCancelling(false)
    }
  }

  async function markAsPaid() {
    if (!payment) return
    setMarkingPaid(true)
    try {
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      })
      if (res.ok) setPayment((p) => p ? { ...p, status: "PAID", paidAt: new Date().toISOString() } : p)
    } finally {
      setMarkingPaid(false)
    }
  }

  const checklist = job.checklistItems ?? []
  const done = checklist.filter((c) => c.completed).length
  const pct = checklist.length ? Math.round((done / checklist.length) * 100) : 0
  const rooms = [...new Set(checklist.map((c) => c.room ?? "General"))]

  return (
    <>
      <div className="p-6 max-w-5xl">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main */}
          <div className="lg:col-span-2 space-y-5">
            {/* Property card */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <Card padding="none" className="overflow-hidden">
                {job.property?.imageUrl && (
                  <div className="aspect-[16/6] overflow-hidden relative">
                    <img
                      src={job.property.imageUrl}
                      alt={job.property.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                      <div>
                        <h2 className="text-white font-bold text-xl">{job.property.name}</h2>
                        <p className="text-white/80 text-sm flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {job.property.address}, {job.property.city}, {job.property.state}
                        </p>
                      </div>
                      <span className={`px-3 py-1.5 text-sm font-semibold rounded-full backdrop-blur-sm ${STATUS_COLORS[job.status]}`}>
                        {STATUS_LABELS[job.status]}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Scheduled</p>
                    <p className="font-semibold text-slate-900 text-sm">{formatDateTime(job.scheduledDate)}</p>
                  </div>
                  {job.property && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Property</p>
                      <p className="font-semibold text-slate-900 text-sm">
                        {job.property.bedrooms}bd / {job.property.bathrooms}ba
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Status</p>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[job.status]}`}>
                      {STATUS_LABELS[job.status]}
                    </span>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Booking info */}
            {job.booking && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card>
                  <CardHeader><CardTitle>Booking Details</CardTitle></CardHeader>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Check-in</p>
                      <p className="font-semibold text-slate-900 text-sm">{formatDate(job.booking.checkIn)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Check-out</p>
                      <p className="font-semibold text-slate-900 text-sm">{formatDate(job.booking.checkOut)}</p>
                    </div>
                    {job.booking.guestName && (
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Guest</p>
                        <p className="font-semibold text-slate-900 text-sm">{job.booking.guestName}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Platform</p>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        job.booking.platform === "AIRBNB"
                          ? "bg-rose-100 text-rose-700"
                          : job.booking.platform === "VRBO"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {job.booking.platform}
                      </span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Issues reported for this job */}
            {issues.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card padding="none">
                  <CardHeader className="p-5 pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <TriangleAlert className="w-4 h-4 text-amber-500" />
                      Issues Reported ({issues.length})
                    </CardTitle>
                  </CardHeader>
                  <div className="divide-y divide-slate-50">
                    {issues.map((issue) => (
                      <div key={issue.id} className="p-4 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${ISSUE_STATUS_CLASS[issue.status]}`}>
                            {issue.status.charAt(0) + issue.status.slice(1).toLowerCase()}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${ISSUE_SEVERITY_CLASS[issue.severity]}`}>
                            {issue.severity.charAt(0) + issue.severity.slice(1).toLowerCase()}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                            {ISSUE_TYPE_LABELS[issue.type] ?? issue.type}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">{issue.description}</p>
                        {issue.photos?.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {issue.photos.map((photo) => (
                              <button key={photo.id} onClick={() => setLightbox(photo.url)}
                                className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 hover:border-blue-400 transition-all flex-shrink-0">
                                <img src={photo.url} alt="" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">
                            by {issue.reportedBy?.name} · {new Date(issue.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          <div className="flex gap-1.5">
                            {issue.status !== "RESOLVED" && (
                              <button
                                onClick={async () => {
                                  const nextStatus = issue.status === "OPEN" ? "REVIEWED" : "RESOLVED"
                                  const res = await fetch(`/api/issues/${issue.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ status: nextStatus }),
                                  })
                                  if (res.ok) setIssues((prev) => prev.map((i) => i.id === issue.id ? { ...i, status: nextStatus } : i))
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                              >
                                Mark {issue.status === "OPEN" ? "Reviewed" : "Resolved"} →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Supply requests */}
            {supplyRequests.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}>
                <Card padding="none">
                  <CardHeader className="p-5 pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-blue-500" />
                      Supply Requests ({supplyRequests.length})
                    </CardTitle>
                  </CardHeader>
                  <div className="divide-y divide-slate-50">
                    {supplyRequests.map((req) => {
                      const items: string[] = (() => { try { return JSON.parse(req.items) } catch { return [] } })()
                      return (
                        <div key={req.id} className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${SUPPLY_STATUS_CLASS[req.status]}`}>
                              {SUPPLY_STATUS_LABELS[req.status]}
                            </span>
                            <div className="flex gap-1.5">
                              {req.status === "PENDING" && (
                                <button
                                  onClick={async () => {
                                    const res = await fetch(`/api/supply-requests/${req.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ status: "ORDERED" }),
                                    })
                                    if (res.ok) setSupplyRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, status: "ORDERED" } : r))
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                  Mark Ordered →
                                </button>
                              )}
                              {req.status === "ORDERED" && (
                                <button
                                  onClick={async () => {
                                    const res = await fetch(`/api/supply-requests/${req.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ status: "DELIVERED" }),
                                    })
                                    if (res.ok) setSupplyRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, status: "DELIVERED" } : r))
                                  }}
                                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                                >
                                  Mark Delivered →
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {items.map((item, i) => (
                              <span key={i} className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                                {item}
                              </span>
                            ))}
                          </div>
                          {req.notes && <p className="text-sm text-slate-600 italic">{req.notes}</p>}
                          <p className="text-xs text-slate-400">
                            by {req.requestedBy?.name} · {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Checklist (read-only for admin) */}
            {checklist.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card padding="none">
                  <CardHeader className="p-5 pb-0">
                    <CardTitle>Cleaning Checklist</CardTitle>
                    <span className="text-sm text-slate-500">{done}/{checklist.length} complete</span>
                  </CardHeader>
                  <div className="px-5 pb-4">
                    <div className="mt-3">
                      <ProgressBar pct={pct} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{pct}% complete</p>
                  </div>
                  {rooms.map((room) => (
                    <div key={room} className="border-t border-slate-50">
                      <div className="px-5 py-2 bg-slate-50">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{room}</p>
                      </div>
                      {checklist
                        .filter((c) => (c.room ?? "General") === room)
                        .map((item) => (
                          <div key={item.id} className="flex items-center gap-3 px-5 py-3 border-b border-slate-50 last:border-0">
                            {item.completed
                              ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                              : <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" />}
                            <span className={`text-sm ${item.completed ? "line-through text-slate-400" : "text-slate-700"}`}>
                              {item.label}
                            </span>
                          </div>
                        ))}
                    </div>
                  ))}
                </Card>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Cleaner assignment */}
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <Card>
                <p className="text-sm font-semibold text-slate-500 mb-4">Assigned Cleaner</p>
                {job.cleaner ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={job.cleaner.name} size="lg" />
                      <div>
                        <p className="font-bold text-slate-900">{job.cleaner.name}</p>
                        {job.cleaner.phone && (
                          <p className="text-xs text-slate-500">{job.cleaner.phone}</p>
                        )}
                      </div>
                    </div>
                    {/* Audit trail */}
                    <div className="bg-slate-50 rounded-xl px-3 py-2.5 space-y-1">
                      <p className="text-xs text-slate-500">
                        <span className="font-medium text-slate-700">Assigned by</span> {job.host?.name ?? "Admin"}
                      </p>
                      <p className="text-xs text-slate-400">
                        Job created {new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    {job.status !== "COMPLETED" && job.status !== "CANCELLED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowAssign(true)}
                      >
                        <UserCheck className="w-4 h-4" /> Reassign
                      </Button>
                    )}
                  </div>
                ) : job.status === "PENDING_ACCEPTANCE" ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 rounded-xl p-3">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      Awaiting cleaner confirmation
                    </div>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAssign(true)}>
                      <UserCheck className="w-4 h-4" /> Reassign
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl p-3">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      No cleaner assigned yet
                    </div>
                    <Button className="w-full" onClick={() => setShowAssign(true)}>
                      <UserCheck className="w-4 h-4" /> Assign Cleaner
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Timeline */}
            {job.booking && (
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                <Card>
                  <CardTitle className="mb-4">Timeline</CardTitle>
                  <div className="space-y-4">
                    {[
                      { label: "Guest check-out", time: job.booking.checkOut, color: "bg-rose-400" },
                      { label: "Cleaning starts", time: job.scheduledDate, color: "bg-blue-500" },
                      { label: "Next check-in", time: job.booking.checkIn, color: "bg-emerald-400" },
                    ].map((event, i) => (
                      <div key={event.label} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${event.color}`} />
                          {i < 2 && <div className="w-0.5 h-8 bg-slate-200 mt-1" />}
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">{event.label}</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatDateTime(event.time)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Payment */}
            {(job.status === "COMPLETED" || payment) && (
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-500">Payment</p>
                  </div>
                  {payment ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Amount</span>
                        <span className="font-bold text-slate-900 text-lg">${payment.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Status</span>
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          payment.status === "PAID"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {payment.status === "PAID" ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                      {payment.paidAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-500">Paid on</span>
                          <span className="text-sm font-medium text-slate-700">
                            {new Date(payment.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                      )}
                      {payment.status === "UNPAID" && (
                        <Button
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                          size="sm"
                          onClick={markAsPaid}
                          disabled={markingPaid}
                        >
                          {markingPaid ? <Spinner size="sm" /> : <><CheckCircle2 className="w-4 h-4" /> Mark as Paid</>}
                        </Button>
                      )}
                      {payment.status === "PAID" && (
                        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                          Payment complete
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Payment will appear once the job is marked complete.</p>
                  )}
                </Card>
              </motion.div>
            )}

            {/* Actions */}
            {job.status !== "CANCELLED" && job.status !== "COMPLETED" && (
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                <Card>
                  <CardTitle className="mb-4">Actions</CardTitle>
                  <Button
                    variant="outline"
                    className="w-full text-red-600 border-red-200 hover:bg-red-50"
                    size="sm"
                    onClick={cancelJob}
                    disabled={cancelling}
                  >
                    {cancelling ? <Spinner size="sm" /> : "Cancel Job"}
                  </Button>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <AssignCleanerModal
        open={showAssign}
        onClose={() => setShowAssign(false)}
        jobId={job.id}
        currentCleanerId={job.cleanerId}
        onAssigned={(cleaner) => setJob((j) => ({ ...j, cleaner, cleanerId: cleaner.id, status: "ASSIGNED" }))}
      />

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </>
  )
}

// ─── Report Issue modal (cleaner) ─────────────────────────────────────────────

const ISSUE_TYPES = [
  { value: "DAMAGE", label: "Damage" },
  { value: "BROKEN_ITEM", label: "Broken Item" },
  { value: "STAIN", label: "Stain" },
  { value: "PEST", label: "Pest" },
  { value: "OTHER", label: "Other" },
]

const SEVERITY_OPTIONS = [
  { value: "LOW", label: "Low", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { value: "MEDIUM", label: "Medium", color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "HIGH", label: "High", color: "text-red-600 bg-red-50 border-red-200" },
]

function ReportIssueModal({ jobId, onClose, onSubmitted }: { jobId: string; onClose: () => void; onSubmitted: () => void }) {
  const [type, setType] = useState("DAMAGE")
  const [severity, setSeverity] = useState("MEDIUM")
  const [description, setDescription] = useState("")
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const combined = [...photos, ...files].slice(0, 5)
    setPhotos(combined)
    setPreviews(combined.map((f) => URL.createObjectURL(f)))
  }

  function removePhoto(index: number) {
    const newPhotos = photos.filter((_, i) => i !== index)
    const newPreviews = previews.filter((_, i) => i !== index)
    setPhotos(newPhotos)
    setPreviews(newPreviews)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) { setError("Please add a description."); return }
    setSubmitting(true)
    setError("")
    try {
      let photoUrls: string[] = []
      if (photos.length > 0) {
        const fd = new FormData()
        photos.forEach((f) => fd.append("files", f))
        const upRes = await fetch("/api/upload", { method: "POST", body: fd })
        if (!upRes.ok) {
          const d = await upRes.json()
          setError(d.error ?? "Photo upload failed")
          return
        }
        const upData = await upRes.json()
        photoUrls = upData.urls
      }

      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, type, severity, description, photoUrls }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "Failed to submit report")
        return
      }
      onSubmitted()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <TriangleAlert className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-slate-900">Report an Issue</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-5 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
            )}

            {/* Issue type */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Issue Type</p>
              <div className="grid grid-cols-3 gap-2">
                {ISSUE_TYPES.map((t) => (
                  <button key={t.value} type="button" onClick={() => setType(t.value)}
                    className={`py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
                      type === t.value
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Severity</p>
              <div className="flex gap-2">
                {SEVERITY_OPTIONS.map((s) => (
                  <button key={s.value} type="button" onClick={() => setSeverity(s.value)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      severity === s.value ? s.color : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Description</p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue — what you found, where it is, any other details..."
                rows={4}
                required
                className="w-full px-3 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
              />
            </div>

            {/* Photos */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Photos ({photos.length}/5)</p>
              <div className="flex flex-wrap gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-slate-900/70 text-white rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-xs">Add</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="hidden"
                onChange={handlePhotoPick}
              />
              <p className="text-xs text-slate-400 mt-1.5">Tap "Add" to take a photo or choose from your gallery</p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-2 border-t border-slate-100 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600" disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : <><TriangleAlert className="w-4 h-4" /> Submit Report</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Request Supplies modal (cleaner) ─────────────────────────────────────────

const PRESET_SUPPLIES = [
  "Bed Linens", "Towels", "Hand Towels", "Washcloths",
  "Toilet Paper", "Paper Towels", "Bleach", "Multi-Surface Cleaner",
  "Dish Soap", "Laundry Detergent", "Trash Bags", "Sponges",
  "Hand Soap", "Shampoo / Conditioner", "Coffee / Tea", "Other",
]

function RequestSuppliesModal({ jobId, onClose, onSubmitted }: { jobId: string; onClose: () => void; onSubmitted: () => void }) {
  const [selected, setSelected] = useState<string[]>([])
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  function toggle(item: string) {
    setSelected((prev) => prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selected.length === 0) { setError("Please select at least one supply."); return }
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/supply-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, items: selected, notes: notes.trim() || null }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "Failed to submit request")
        return
      }
      onSubmitted()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-500" />
            <h2 className="font-bold text-slate-900">Request Supplies</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-5 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
            )}

            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">Select supplies needed</p>
              <p className="text-xs text-slate-400 mb-3">Tap items to select. The host will be notified to restock.</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_SUPPLIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggle(item)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      selected.includes(item)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Additional notes (optional)</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific details — brand, quantity, urgency..."
                rows={3}
                className="w-full px-3 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
              />
            </div>

            {selected.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1.5">Selected ({selected.length})</p>
                <p className="text-sm text-blue-800">{selected.join(", ")}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-2 border-t border-slate-100 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={submitting || selected.length === 0}>
              {submitting ? <Spinner size="sm" /> : <><ShoppingCart className="w-4 h-4" /> Send Request</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Cleaner job detail ───────────────────────────────────────────────────────

function CleanerJobDetail({ job: initialJob }: { job: Job }) {
  const [job, setJob] = useState(initialJob)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialJob.checklistItems ?? [])
  const [savingId, setSavingId] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [showReportIssue, setShowReportIssue] = useState(false)
  const [issueSubmitted, setIssueSubmitted] = useState(false)
  const [showRequestSupplies, setShowRequestSupplies] = useState(false)
  const [supplySubmitted, setSupplySubmitted] = useState(false)

  const done = checklist.filter((c) => c.completed).length
  const pct = checklist.length ? Math.round((done / checklist.length) * 100) : 0
  const allDone = checklist.length > 0 && done === checklist.length

  const isSameDay =
    job.booking?.checkIn &&
    new Date(job.booking.checkIn).toDateString() === new Date(job.scheduledDate).toDateString()

  async function toggleItem(item: ChecklistItem) {
    const newVal = !item.completed
    setChecklist((prev) =>
      prev.map((c) => (c.id === item.id ? { ...c, completed: newVal } : c))
    )
    setSavingId(item.id)
    try {
      await fetch(`/api/checklist-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: newVal }),
      })
    } catch {
      // revert on error
      setChecklist((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, completed: item.completed } : c))
      )
    } finally {
      setSavingId(null)
    }
  }

  async function updateStatus(status: string) {
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) setJob((j) => ({ ...j, status: status as Job["status"] }))
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function respondToJob(action: "ACCEPT" | "DECLINE") {
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        const d = await res.json()
        setJob((j) => ({ ...j, status: d.status as Job["status"] }))
      }
    } finally {
      setUpdatingStatus(false)
    }
  }

  const rooms = [...new Set(checklist.map((c) => c.room ?? "General"))]

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-8">
      {/* Header card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {job.property?.imageUrl && (
            <div className="aspect-[16/7] overflow-hidden relative">
              <img
                src={job.property.imageUrl}
                alt={job.property.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4">
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[job.status]}`}>
                  {STATUS_LABELS[job.status]}
                </span>
              </div>
            </div>
          )}
          <div className="p-4">
            <h2 className="font-bold text-slate-900 text-lg leading-tight">
              {job.property?.name ?? "Property"}
            </h2>
            {job.property && (
              <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5" />
                {job.property.address}, {job.property.city}, {job.property.state}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Same-day turnover alert */}
      {isSameDay && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Same-day turnover</p>
              <p className="text-xs text-amber-700 mt-0.5">
                New guests check in today. Please prioritize completing this clean on time.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Schedule info */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Schedule</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Cleaning date</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatDateShort(job.scheduledDate)}, {formatTime(job.scheduledDate)}
                </p>
              </div>
            </div>
            {job.booking && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-rose-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Guest check-out</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDate(job.booking.checkOut)} at {formatTime(job.booking.checkOut)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Next check-in</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDate(job.booking.checkIn)} at {formatTime(job.booking.checkIn)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Pay + Access Info */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-4">
          {/* Pay */}
          {job.property?.cleaningFee ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Pay for this job</p>
                <p className="text-sm font-bold text-emerald-700">${job.property.cleaningFee.toFixed(2)}</p>
              </div>
            </div>
          ) : null}

          {/* Access instructions */}
          {job.property?.accessInstructions && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Entry / Access Instructions</p>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                  {job.property.accessInstructions}
                </p>
              </div>
            </div>
          )}

          {!job.property?.cleaningFee && !job.property?.accessInstructions && (
            <p className="text-sm text-slate-400 text-center py-1">No additional details from host.</p>
          )}
        </div>
      </motion.div>

      {/* Checklist */}
      {checklist.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-50">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-slate-900">Cleaning Checklist</p>
                <span className="text-sm font-bold text-slate-700">{done}/{checklist.length}</span>
              </div>
              <ProgressBar pct={pct} />
              <p className="text-xs text-slate-400 mt-1.5">{pct}% complete</p>
            </div>

            {allDone && job.status !== "COMPLETED" && (
              <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <p className="text-sm font-semibold text-emerald-900">All items checked! Mark the job complete below.</p>
              </div>
            )}

            {job.status === "COMPLETED" && (
              <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">Job Complete!</p>
                  <p className="text-xs text-emerald-700">Great work — this cleaning is done.</p>
                </div>
              </div>
            )}

            {rooms.map((room) => (
              <div key={room}>
                <div className="px-4 py-2 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{room}</p>
                </div>
                {checklist
                  .filter((c) => (c.room ?? "General") === room)
                  .sort((a, b) => a.order - b.order)
                  .map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item)}
                      disabled={savingId === item.id || job.status === "COMPLETED"}
                      className="w-full flex items-center gap-4 px-4 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left min-h-[56px] disabled:opacity-70"
                    >
                      {savingId === item.id ? (
                        <Spinner size="sm" className="flex-shrink-0" />
                      ) : item.completed ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-6 h-6 text-slate-300 flex-shrink-0" />
                      )}
                      <span className={`text-sm font-medium ${item.completed ? "line-through text-slate-400" : "text-slate-800"}`}>
                        {item.label}
                      </span>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Action buttons */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="space-y-3">

        {/* Accept / Decline for pending jobs */}
        {job.status === "PENDING_ACCEPTANCE" && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-purple-900">Action Required</p>
                <p className="text-sm text-purple-700 mt-0.5">Please accept or decline this job so the host can confirm the schedule.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1 min-h-[52px] text-base bg-emerald-600 hover:bg-emerald-700"
                onClick={() => respondToJob("ACCEPT")}
                disabled={updatingStatus}
              >
                {updatingStatus ? <Spinner size="sm" /> : <><ThumbsUp className="w-4 h-4" /> Accept</>}
              </Button>
              <Button
                variant="outline"
                className="flex-1 min-h-[52px] text-base border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => respondToJob("DECLINE")}
                disabled={updatingStatus}
              >
                {updatingStatus ? <Spinner size="sm" /> : <><ThumbsDown className="w-4 h-4" /> Decline</>}
              </Button>
            </div>
          </div>
        )}

        {job.status === "ASSIGNED" && (
          <Button
            className="w-full min-h-[52px] text-base"
            onClick={() => updateStatus("IN_PROGRESS")}
            disabled={updatingStatus}
          >
            {updatingStatus ? <Spinner size="sm" /> : "Start Cleaning"}
          </Button>
        )}
        {job.status === "IN_PROGRESS" && (
          <Button
            className="w-full min-h-[52px] text-base"
            disabled={!allDone || updatingStatus}
            onClick={() => updateStatus("COMPLETED")}
          >
            {updatingStatus ? (
              <Spinner size="sm" />
            ) : allDone ? (
              "Mark Job Complete"
            ) : (
              `Complete checklist first (${pct}%)`
            )}
          </Button>
        )}

        {/* Report Issue + Request Supplies — available any time except cancelled */}
        {job.status !== "CANCELLED" && (
          <div className="pt-1 space-y-2">
            {supplySubmitted ? (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-2xl text-sm text-blue-700">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Supply request sent — host has been notified.
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowRequestSupplies(true)}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 rounded-2xl hover:bg-blue-50 transition-all"
              >
                <ShoppingCart className="w-4 h-4" />
                Request Supplies
              </button>
            )}
            {issueSubmitted ? (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Issue reported — admin has been notified.
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowReportIssue(true)}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-amber-600 hover:text-amber-700 border border-amber-200 hover:border-amber-300 rounded-2xl hover:bg-amber-50 transition-all"
              >
                <TriangleAlert className="w-4 h-4" />
                Report Damage or Issue
              </button>
            )}
          </div>
        )}
      </motion.div>

      {showReportIssue && (
        <ReportIssueModal
          jobId={job.id}
          onClose={() => setShowReportIssue(false)}
          onSubmitted={() => { setShowReportIssue(false); setIssueSubmitted(true) }}
        />
      )}

      {showRequestSupplies && (
        <RequestSuppliesModal
          jobId={job.id}
          onClose={() => setShowRequestSupplies(false)}
          onSubmitted={() => { setShowRequestSupplies(false); setSupplySubmitted(true) }}
        />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, loading: authLoading } = useAuth()
  const isAdmin = user?.role === "ADMIN"

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/jobs/${id}`)
        if (res.status === 404) { setNotFound(true); return }
        if (res.ok) {
          const d = await res.json()
          setJob(d.job ?? d)
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  return (
    <div className="min-h-screen">
      <Header
        title="Job Details"
        subtitle={job?.property?.name ?? "Loading…"}
        actions={
          <Link href="/jobs">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
        }
      />

      {loading || authLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner size="lg" />
        </div>
      ) : notFound || !job ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
          <Building2 className="w-12 h-12 mb-4 text-slate-200" />
          <p className="font-medium">Job not found</p>
          <Link href="/jobs" className="mt-4">
            <Button variant="outline" size="sm">Back to Jobs</Button>
          </Link>
        </div>
      ) : isAdmin ? (
        <AdminJobDetail job={job} />
      ) : (
        <CleanerJobDetail job={job} />
      )}
    </div>
  )
}
