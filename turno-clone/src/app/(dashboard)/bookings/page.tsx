"use client"
import { useEffect, useState } from "react"
import { useAuth } from "@/components/layout/Providers"
import { Header } from "@/components/layout/Header"
import { Card, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Spinner } from "@/components/ui/Spinner"
import { Modal } from "@/components/ui/Modal"
import { Select } from "@/components/ui/Select"
import { Input } from "@/components/ui/Input"
import { formatDate, formatDateTime } from "@/lib/utils"
import type { Booking, Property, User } from "@/types"
import {
  Calendar, RefreshCw, Plus, CheckCircle2, AlertCircle,
  Building2, Users, Clock,
} from "lucide-react"
import { motion } from "framer-motion"
import { isSameDay } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingWithProperty extends Booking {
  property: Property
}

interface PropertyGroup {
  property: Property
  bookings: BookingWithProperty[]
}

// ─── Create Job from Booking Modal ────────────────────────────────────────────

interface CreateJobModalProps {
  open: boolean
  onClose: () => void
  booking: BookingWithProperty | null
  onCreated: () => void
}

function CreateJobFromBookingModal({ open, onClose, booking, onCreated }: CreateJobModalProps) {
  const [cleaners, setCleaners] = useState<User[]>([])
  const [cleanerId, setCleanerId] = useState("")
  const [scheduledDate, setScheduledDate] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !booking) return
    // Pre-fill scheduled date: checkout date at 11:00 AM
    const d = new Date(booking.checkOut)
    d.setHours(11, 0, 0, 0)
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    setScheduledDate(local)
    setCleanerId("")
    setError("")

    fetch("/api/users?role=CLEANER&approved=true")
      .then((r) => r.json())
      .then((d) => setCleaners(d.users ?? d))
      .catch(() => {})
  }, [open, booking])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!booking) return
    setError("")
    setSubmitting(true)
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: booking.propertyId,
          bookingId: booking.id,
          scheduledDate,
          cleanerId: cleanerId || undefined,
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
    <Modal
      open={open}
      onClose={onClose}
      title="Create Cleaning Job"
      description={booking ? `${booking.property.name} · Check-out ${formatDate(booking.checkOut)}` : ""}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

// ─── Booking row ──────────────────────────────────────────────────────────────

interface BookingRowProps {
  booking: BookingWithProperty
  nextBooking: BookingWithProperty | null
  onCreateJob: (b: BookingWithProperty) => void
}

function BookingRow({ booking, nextBooking, onCreateJob }: BookingRowProps) {
  const hasJob = (booking.jobs?.length ?? 0) > 0
  const assignedJob = booking.jobs?.[0]
  const sameDayTurnover =
    nextBooking !== null &&
    isSameDay(new Date(booking.checkOut), new Date(nextBooking.checkIn))

  return (
    <div className="p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Dates row */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
              booking.platform === "AIRBNB"
                ? "bg-rose-100 text-rose-700"
                : booking.platform === "VRBO"
                ? "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-700"
            }`}>
              {booking.platform}
            </span>
            {booking.guestName && (
              <span className="text-slate-700 font-medium truncate">{booking.guestName}</span>
            )}
            {sameDayTurnover && (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Same-day turnover
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Check-in</span>
              <span className="font-semibold text-slate-900">{formatDate(booking.checkIn)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Check-out</span>
              <span className="font-semibold text-slate-900">{formatDate(booking.checkOut)}</span>
            </div>
          </div>

          {/* Cleaning status */}
          <div>
            {hasJob && assignedJob ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-xs text-emerald-700 font-medium">
                  Cleaning assigned
                  {assignedJob.cleaner ? ` · ${assignedJob.cleaner.name}` : ""}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-xs text-amber-700 font-medium">No cleaning job yet</span>
              </div>
            )}
          </div>
        </div>

        {/* Action */}
        <div className="flex-shrink-0">
          {!hasJob ? (
            <Button
              size="sm"
              onClick={() => onCreateJob(booking)}
              className="whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Create Job
            </Button>
          ) : (
            <span className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-100">
              Scheduled
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Property group ───────────────────────────────────────────────────────────

interface PropertyGroupCardProps {
  group: PropertyGroup
  onCreateJob: (b: BookingWithProperty) => void
}

function PropertyGroupCard({ group, onCreateJob }: PropertyGroupCardProps) {
  const { property, bookings } = group
  const sortedBookings = [...bookings].sort(
    (a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()
  )

  return (
    <Card padding="none">
      <CardHeader className="p-5 pb-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <CardTitle>{property.name}</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              {property.city}, {property.state}
              {property.lastSyncedAt
                ? ` · Synced ${formatDateTime(property.lastSyncedAt)}`
                : ""}
            </p>
          </div>
        </div>
      </CardHeader>

      <div className="mt-4">
        {sortedBookings.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">
            No bookings found for this property.
          </div>
        ) : (
          sortedBookings.map((booking, i) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              nextBooking={sortedBookings[i + 1] ?? null}
              onCreateJob={onCreateJob}
            />
          ))
        )}
      </div>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "ADMIN"

  const [groups, setGroups] = useState<PropertyGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [createModal, setCreateModal] = useState<BookingWithProperty | null>(null)

  async function loadBookings() {
    try {
      const res = await fetch("/api/bookings")
      if (!res.ok) return
      const data: BookingWithProperty[] = (await res.json()).bookings ?? await res.clone().json()

      // Group by property
      const map = new Map<string, PropertyGroup>()
      for (const b of data) {
        if (!b.property) continue
        if (!map.has(b.propertyId)) {
          map.set(b.propertyId, { property: b.property, bookings: [] })
        }
        map.get(b.propertyId)!.bookings.push(b)
      }
      setGroups(Array.from(map.values()))
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBookings() }, [])

  async function handleSync() {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch("/api/bookings/sync", { method: "POST" })
      const d = await res.json().catch(() => ({}))
      setSyncMessage(d.message ?? (res.ok ? "Sync complete!" : "Sync failed."))
      if (res.ok) await loadBookings()
    } catch {
      setSyncMessage("Sync failed. Please try again.")
    } finally {
      setSyncing(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <Header title="Bookings" subtitle="Admin access only" />
        <div className="flex items-center justify-center min-h-[400px] text-slate-500">
          <p>You don't have permission to view this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header
        title="Bookings"
        subtitle="Manage property reservations and cleaning schedules"
        actions={
          <Button size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Syncing…" : "Sync Now"}
          </Button>
        }
      />

      <div className="p-6 max-w-4xl space-y-6">
        {syncMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-3 p-4 rounded-xl border text-sm font-medium ${
              syncMessage.toLowerCase().includes("fail")
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
          >
            {syncMessage.toLowerCase().includes("fail") ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            )}
            {syncMessage}
          </motion.div>
        )}

        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Spinner size="lg" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Calendar className="w-14 h-14 mx-auto mb-4 text-slate-200" />
            <p className="font-semibold text-lg">No bookings found</p>
            <p className="text-sm mt-1">Click "Sync Now" to pull bookings from your connected platforms.</p>
            <Button className="mt-6" onClick={handleSync} disabled={syncing}>
              {syncing ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
              {syncing ? "Syncing…" : "Sync Now"}
            </Button>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            className="space-y-6"
          >
            {groups.map((group) => (
              <motion.div
                key={group.property.id}
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              >
                <PropertyGroupCard
                  group={group}
                  onCreateJob={(b) => setCreateModal(b)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <CreateJobFromBookingModal
        open={createModal !== null}
        onClose={() => setCreateModal(null)}
        booking={createModal}
        onCreated={loadBookings}
      />
    </div>
  )
}
