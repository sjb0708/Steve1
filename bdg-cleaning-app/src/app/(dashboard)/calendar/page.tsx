"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Select } from "@/components/ui/Select"
import { Spinner } from "@/components/ui/Spinner"
import { ChevronLeft, ChevronRight, Zap } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, addDays, subDays } from "date-fns"
import { motion } from "framer-motion"
import type { Job, Booking, Property } from "@/types"

const STATUS_LABEL: Record<string, string> = {
  UNASSIGNED: "Needs Cleaner",
  PENDING_ACCEPTANCE: "Awaiting Confirmation",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

const STATUS_PILL: Record<string, string> = {
  UNASSIGNED: "bg-amber-100 text-amber-700",
  PENDING_ACCEPTANCE: "bg-purple-100 text-purple-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
}

// Short enough to fit as a badge directly on the checkout-day cell
const STATUS_SHORT_LABEL: Record<string, string> = {
  UNASSIGNED: "Needs cleaner",
  PENDING_ACCEPTANCE: "Awaiting confirm",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "Cleaning now",
  COMPLETED: "Cleaned",
  CANCELLED: "Cancelled",
}

const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "UNASSIGNED", label: "Needs Cleaner" },
  { value: "PENDING_ACCEPTANCE", label: "Awaiting Confirmation" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
]

// Once a cleaner has accepted, the badge is more useful showing who than
// the generic "Assigned" status — that's the info Steve actually wants at
// a glance on the checkout day.
function checkoutBadgeText(job: Job) {
  if (job.status === "ASSIGNED" && job.cleaner?.name) return job.cleaner.name.split(" ")[0]
  return STATUS_SHORT_LABEL[job.status] ?? job.status
}

const BAR_ROW_HEIGHT = 34
const HEADER_ROW_HEIGHT = 64

// One color per property so multiple listings are distinguishable on the
// calendar at a glance. Deliberately avoids amber/purple/blue/orange/emerald —
// those hues are already reserved for cleaning-status badges, so a property
// bar never gets mistaken for a status indicator.
const PROPERTY_COLORS = [
  { bar: "bg-teal-700/90 hover:bg-teal-800", dot: "bg-teal-600" },
  { bar: "bg-rose-700/90 hover:bg-rose-800", dot: "bg-rose-600" },
  { bar: "bg-fuchsia-700/90 hover:bg-fuchsia-800", dot: "bg-fuchsia-600" },
  { bar: "bg-slate-700/90 hover:bg-slate-800", dot: "bg-slate-600" },
  { bar: "bg-cyan-700/90 hover:bg-cyan-800", dot: "bg-cyan-600" },
]

function colorForProperty(propertyId: string | undefined) {
  if (!propertyId) return PROPERTY_COLORS[0]
  let hash = 0
  for (let i = 0; i < propertyId.length; i++) hash = (hash * 31 + propertyId.charCodeAt(i)) >>> 0
  return PROPERTY_COLORS[hash % PROPERTY_COLORS.length]
}

type Segment = {
  booking: Booking
  startCol: number
  endCol: number
  startFrac: number
  endFrac: number
  continuesLeft: boolean
  continuesRight: boolean
  lane: number
}

// Airbnb-style spanning bars: one continuous bar per stay across the week,
// instead of separate IN/OUT tags stacked on each day. Bars start/end at the
// MIDPOINT of the check-in/checkout day (guest leaves that morning, next
// guest arrives that afternoon) so back-to-back bookings share a lane
// instead of stacking — same visual language as Airbnb's own calendar.
function buildWeekSegments(week: Date[], bookings: Booking[]): { segments: Segment[]; laneCount: number } {
  const weekStart = week[0]
  const weekEnd = week[6]
  const segments: Segment[] = []

  for (const b of bookings) {
    // Booking dates are stored at noon UTC (see the iCal sync) to dodge
    // off-by-one bugs elsewhere — but that means raw `<`/`>` against local
    // midnight week boundaries can misfire. Normalize to calendar-date-only
    // (local) before comparing, so a checkout at "noon" still lands on the
    // right day relative to week boundaries built from local midnight.
    const rawCheckIn = new Date(b.checkIn)
    const rawCheckOut = new Date(b.checkOut)
    const checkIn = new Date(rawCheckIn.getFullYear(), rawCheckIn.getMonth(), rawCheckIn.getDate())
    const checkOut = new Date(rawCheckOut.getFullYear(), rawCheckOut.getMonth(), rawCheckOut.getDate())
    if (checkOut < weekStart || checkIn > weekEnd) continue

    const clippedStart = checkIn < weekStart ? weekStart : checkIn
    const clippedEnd = checkOut > weekEnd ? weekEnd : checkOut
    const startCol = week.findIndex((d) => isSameDay(d, clippedStart))
    const endCol = week.findIndex((d) => isSameDay(d, clippedEnd))
    if (startCol === -1 || endCol === -1) continue

    const continuesLeft = checkIn < weekStart
    const continuesRight = checkOut > weekEnd

    segments.push({
      booking: b,
      startCol,
      endCol,
      startFrac: continuesLeft ? 0 : startCol + 0.5,
      endFrac: continuesRight ? 7 : endCol + 0.5,
      continuesLeft,
      continuesRight,
      lane: 0,
    })
  }

  segments.sort((a, b) => a.startFrac - b.startFrac)
  const laneEnds: number[] = []
  for (const seg of segments) {
    let lane = laneEnds.findIndex((end) => end <= seg.startFrac)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(seg.endFrac)
    } else {
      laneEnds[lane] = seg.endFrac
    }
    seg.lane = lane
  }

  return { segments, laneCount: laneEnds.length }
}

export default function CalendarPage() {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [jobs, setJobs] = useState<Job[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [allProperties, setAllProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [propertyFilter, setPropertyFilter] = useState("ALL")
  const [platformFilter, setPlatformFilter] = useState<"ALL" | "airbnb" | "vrbo">("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")

  useEffect(() => {
    Promise.all([
      fetch("/api/jobs?limit=200").then((r) => r.json()).then((d) => setJobs(d.jobs || [])),
      fetch("/api/bookings").then((r) => (r.ok ? r.json() : { bookings: [] })).then((d) => setBookings(d.bookings || [])),
      fetch("/api/properties").then((r) => r.json()).then((d) => setAllProperties(d.properties || [])),
    ])
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const matchesFilters = (propertyId: string | undefined, platform: string | undefined) =>
    (propertyFilter === "ALL" || propertyId === propertyFilter) &&
    (platformFilter === "ALL" || platform?.toLowerCase() === platformFilter)

  const visibleJobs = jobs.filter(
    (j) => matchesFilters(j.property?.id, j.booking?.platform) && (statusFilter === "ALL" || j.status === statusFilter)
  )
  const visibleBookings = bookings.filter((b) => matchesFilters(b.property?.id, b.platform))

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  // Full weeks including adjacent-month days (dimmed), like Airbnb's grid —
  // so stay bars have real dates to span into at month boundaries.
  const gridStart = subDays(monthStart, monthStart.getDay())
  const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay())
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const weeks: Date[][] = []
  for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7))

  // All jobs whose booking checks out on this day (one per property, usually)
  const getCheckoutJobsForDay = (date: Date) =>
    visibleJobs.filter(
      (j) => j.status !== "CANCELLED" && bookings.some((b) => b.id === j.bookingId && isSameDay(new Date(b.checkOut), date))
    )

  // A same-day turnover: this property has a guest leaving AND a different
  // guest arriving on the exact same date — the tightest, highest-risk
  // cleaning window since there's no buffer day between stays.
  const hasSameDayTurnover = (date: Date, propertyId: string | undefined) => {
    if (!propertyId) return false
    const checkingOut = visibleBookings.some((b) => b.property?.id === propertyId && isSameDay(new Date(b.checkOut), date))
    const checkingIn = visibleBookings.some((b) => b.property?.id === propertyId && isSameDay(new Date(b.checkIn), date))
    return checkingOut && checkingIn
  }

  const propertyById = new Map<string, NonNullable<Booking["property"]>>()
  for (const b of visibleBookings) {
    if (b.property?.id && !propertyById.has(b.property.id)) propertyById.set(b.property.id, b.property)
  }
  const distinctProperties = Array.from(propertyById.values())

  return (
    <div className="min-h-screen">
      <Header
        title="Calendar"
        subtitle="View and manage your cleaning schedule"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold text-slate-700 min-w-[140px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setCurrentMonth(new Date())}>Today</Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-96"><Spinner size="lg" /></div>
      ) : (
        <div className="p-6 max-w-[1800px]">
          <div className="flex flex-wrap gap-3 mb-4">
            {allProperties.length > 1 && (
              <>
                <Select
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  className="w-52"
                  options={[
                    { value: "ALL", label: "All Properties" },
                    ...allProperties.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
                <Select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value as "ALL" | "airbnb" | "vrbo")}
                  className="w-40"
                  options={[
                    { value: "ALL", label: "All Platforms" },
                    { value: "airbnb", label: "Airbnb" },
                    { value: "vrbo", label: "VRBO" },
                  ]}
                />
              </>
            )}
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-56"
              options={STATUS_FILTER_OPTIONS}
            />
          </div>

          <Card padding="none">
            <div className="grid grid-cols-7 border-b border-slate-100">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="p-4 text-center text-sm font-semibold text-slate-400">{d}</div>
              ))}
            </div>

            <div>
              {weeks.map((week) => {
                const { segments, laneCount } = buildWeekSegments(week, visibleBookings)
                const rowHeight = HEADER_ROW_HEIGHT + Math.max(laneCount, 1) * BAR_ROW_HEIGHT + 6

                return (
                  <div key={week[0].toISOString()} className="relative border-b border-slate-50" style={{ minHeight: rowHeight }}>
                    {/* Day number strip */}
                    <div className="grid grid-cols-7">
                      {week.map((day) => {
                        const isCurrentDay = isToday(day)
                        const inMonth = isSameMonth(day, currentMonth)
                        const checkoutJobs = getCheckoutJobsForDay(day)

                        return (
                          <div key={day.toISOString()}
                            className={`px-2 pt-2 pb-1.5 border-r border-slate-50 flex flex-col gap-1
                              ${!inMonth ? "opacity-40" : ""}`}
                            style={{ height: HEADER_ROW_HEIGHT }}>
                            <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors
                              ${isCurrentDay ? "bg-blue-600 text-white" : "text-slate-700"}`}>
                              {format(day, "d")}
                            </span>
                            <div className="flex flex-col gap-0.5 w-full">
                              {checkoutJobs.map((job) => {
                                const turnover = hasSameDayTurnover(day, job.property?.id)
                                return (
                                  <button
                                    key={job.id}
                                    type="button"
                                    onClick={() => router.push(`/jobs/${job.id}`)}
                                    title={`${job.property?.name ?? ""} — ${job.status === "ASSIGNED" && job.cleaner?.name ? `Assigned to ${job.cleaner.name}` : STATUS_LABEL[job.status]}${turnover ? " — Same-day turnover" : ""}`}
                                    className={`self-start flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none truncate max-w-full hover:opacity-80 transition-opacity ${STATUS_PILL[job.status] ?? "bg-slate-100 text-slate-500"}`}
                                  >
                                    {turnover && <Zap className="w-2.5 h-2.5 flex-shrink-0 fill-current" />}
                                    {distinctProperties.length > 1 && `${job.property?.name?.split(" ")[0]}: `}
                                    {checkoutBadgeText(job)}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Spanning stay bars — positioned by fraction-of-week, not whole grid columns,
                        so a checkout and the next check-in on the same day sit edge-to-edge, not stacked */}
                    <div className="relative" style={{ height: Math.max(laneCount, 1) * BAR_ROW_HEIGHT }}>
                      {segments.map((seg) => (
                        <div
                          key={`${seg.booking.id}-${seg.lane}`}
                          className={`absolute flex items-center px-2.5 h-6 text-xs font-medium text-white truncate
                            ${colorForProperty(seg.booking.property?.id).bar}
                            ${seg.continuesLeft ? "" : "rounded-l-full"}
                            ${seg.continuesRight ? "" : "rounded-r-full"}`}
                          style={{
                            top: seg.lane * BAR_ROW_HEIGHT,
                            left: `calc(${(seg.startFrac / 7) * 100}% + ${seg.continuesLeft ? 0 : 2}px)`,
                            width: `calc(${((seg.endFrac - seg.startFrac) / 7) * 100}% - ${(seg.continuesLeft ? 0 : 2) + (seg.continuesRight ? 0 : 2)}px)`,
                          }}
                        >
                          {seg.booking.property?.name ?? ""} · {seg.booking.guestName ?? "Reserved"}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Legend */}
          <div className="mt-4 space-y-2">
            {distinctProperties.length > 1 ? (
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-xs text-slate-400">Properties:</span>
                {distinctProperties.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 text-sm text-slate-600">
                    <span className={`w-3.5 h-2 rounded-full ${colorForProperty(p.id).dot}`} />
                    {p.name}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className={`w-3.5 h-2 rounded-full ${colorForProperty(distinctProperties[0]?.id).dot}`} />
                Guest stay (bar spans check-in to checkout)
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-xs text-slate-400">Cleaning status — click a badge to open the job:</span>
              {[
                { color: "bg-amber-100 text-amber-700", label: "Needs Cleaner" },
                { color: "bg-purple-100 text-purple-700", label: "Awaiting Confirmation" },
                { color: "bg-blue-100 text-blue-700", label: "Assigned" },
                { color: "bg-orange-100 text-orange-700", label: "In Progress" },
                { color: "bg-emerald-100 text-emerald-700", label: "Completed" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5 text-sm text-slate-600">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${l.color}`}>{l.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <Zap className="w-3.5 h-3.5 text-slate-500 fill-current" />
              Same-day turnover — a guest leaves and a new guest arrives the same day
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
