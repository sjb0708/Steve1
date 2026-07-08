"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Select } from "@/components/ui/Select"
import { Spinner } from "@/components/ui/Spinner"
import { formatCurrency } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Building2, Clock, User } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, addDays, subDays } from "date-fns"
import { motion } from "framer-motion"
import type { Job, Booking, Property } from "@/types"

const STATUS_DOT: Record<string, string> = {
  UNASSIGNED: "bg-amber-400",
  PENDING_ACCEPTANCE: "bg-purple-400",
  ASSIGNED: "bg-blue-500",
  IN_PROGRESS: "bg-orange-500",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-slate-300",
}

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
}

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
// calendar at a glance, not just by reading the name in a small bar.
const PROPERTY_COLORS = [
  { bar: "bg-indigo-700/90 hover:bg-indigo-800", dot: "bg-indigo-600" },
  { bar: "bg-teal-700/90 hover:bg-teal-800", dot: "bg-teal-600" },
  { bar: "bg-rose-700/90 hover:bg-rose-800", dot: "bg-rose-600" },
  { bar: "bg-amber-700/90 hover:bg-amber-800", dot: "bg-amber-600" },
  { bar: "bg-violet-700/90 hover:bg-violet-800", dot: "bg-violet-600" },
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
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())
  const [jobs, setJobs] = useState<Job[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [allProperties, setAllProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [propertyFilter, setPropertyFilter] = useState("ALL")
  const [platformFilter, setPlatformFilter] = useState<"ALL" | "airbnb" | "vrbo">("ALL")

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

  const visibleJobs = jobs.filter((j) => matchesFilters(j.property?.id, j.booking?.platform))
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

  const getJobsForDay = (date: Date) =>
    visibleJobs.filter((j) => j.status !== "CANCELLED" && isSameDay(new Date(j.scheduledDate), date))

  const getBookingEventsForDay = (date: Date) => {
    const events: { booking: Booking; type: "IN" | "OUT" }[] = []
    for (const b of visibleBookings) {
      if (isSameDay(new Date(b.checkIn), date)) events.push({ booking: b, type: "IN" })
      if (isSameDay(new Date(b.checkOut), date)) events.push({ booking: b, type: "OUT" })
    }
    return events
  }

  const selectedDayJobs = selectedDay ? getJobsForDay(selectedDay) : []
  const selectedDayBookingEvents = selectedDay ? getBookingEventsForDay(selectedDay) : []

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
            <Button size="sm" variant="secondary" onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()) }}>Today</Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-96"><Spinner size="lg" /></div>
      ) : (
        <div className="p-6 max-w-[1800px]">
          {allProperties.length > 1 && (
            <div className="flex flex-wrap gap-3 mb-4">
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
            </div>
          )}
          <div className="grid lg:grid-cols-[1fr_340px] gap-6">
            {/* Calendar grid */}
            <div>
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
                            const isSelected = selectedDay && isSameDay(day, selectedDay)
                            const isCurrentDay = isToday(day)
                            const inMonth = isSameMonth(day, currentMonth)
                            const checkoutJob = getJobsForDay(day).find((j) =>
                              bookings.some((b) => b.id === j.bookingId && isSameDay(new Date(b.checkOut), day))
                            )

                            return (
                              <motion.div key={day.toISOString()} whileTap={{ scale: 0.97 }}
                                onClick={() => setSelectedDay(day)}
                                className={`px-2 pt-2 pb-1.5 border-r border-slate-50 cursor-pointer transition-colors flex flex-col gap-1
                                  ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"}
                                  ${!inMonth ? "opacity-40" : ""}`}
                                style={{ height: HEADER_ROW_HEIGHT }}>
                                <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors
                                  ${isCurrentDay ? "bg-blue-600 text-white" : isSelected ? "bg-blue-100 text-blue-700" : "text-slate-700"}`}>
                                  {format(day, "d")}
                                </span>
                                {checkoutJob && (
                                  <span
                                    className={`self-start px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none truncate max-w-full ${STATUS_PILL[checkoutJob.status] ?? "bg-slate-100 text-slate-500"}`}
                                    title={checkoutJob.status === "ASSIGNED" && checkoutJob.cleaner?.name ? `Assigned to ${checkoutJob.cleaner.name}` : STATUS_LABEL[checkoutJob.status]}
                                  >
                                    {checkoutBadgeText(checkoutJob)}
                                  </span>
                                )}
                              </motion.div>
                            )
                          })}
                        </div>

                        {/* Spanning stay bars — positioned by fraction-of-week, not whole grid columns,
                            so a checkout and the next check-in on the same day sit edge-to-edge, not stacked */}
                        <div className="relative" style={{ height: Math.max(laneCount, 1) * BAR_ROW_HEIGHT }}>
                          {segments.map((seg) => (
                            <button
                              key={`${seg.booking.id}-${seg.lane}`}
                              type="button"
                              onClick={() => setSelectedDay(week[seg.startCol])}
                              className={`absolute flex items-center px-2.5 h-6 text-xs font-medium text-white truncate transition-colors
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
                            </button>
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
                  <span className="text-xs text-slate-400">Cleaning status, shown on the checkout day:</span>
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
              </div>
            </div>

            {/* Day detail panel */}
            <div className="space-y-4">
              <Card>
                <p className="font-semibold text-slate-900 mb-4">
                  {selectedDay ? format(selectedDay, "EEEE, MMMM d") : "Select a day"}
                </p>

                {selectedDayBookingEvents.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {selectedDayBookingEvents.map((ev, idx) => (
                      <div key={`${ev.booking.id}-${ev.type}-${idx}`}
                        className={`flex items-center gap-2 p-2.5 rounded-lg text-sm border
                          ${ev.type === "OUT" ? "bg-rose-50/60 border-rose-100 text-rose-700" : "bg-teal-50/60 border-teal-100 text-teal-700"}`}>
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          <b>{ev.type === "OUT" ? "Check-out" : "Check-in"}</b> · {ev.booking.property?.name}
                          {ev.booking.guestName ? ` · ${ev.booking.guestName}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {selectedDayJobs.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDayJobs.map((job) => (
                      <motion.div key={job.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        onClick={() => router.push(`/jobs/${job.id}`)}
                        className="p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-pointer group">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[job.status]}`} />
                          <p className="font-semibold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">{job.property?.name}</p>
                        </div>
                        <div className="space-y-1 text-xs text-slate-500">
                          <p className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {format(new Date(job.scheduledDate), "h:mm a")} · {(job.duration ?? 180) / 60}h
                          </p>
                          <p className="flex items-center gap-1.5">
                            <User className="w-3 h-3" />
                            {job.cleaner?.name ?? <span className="text-amber-600 font-medium">No cleaner assigned</span>}
                          </p>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL[job.status] ?? "bg-slate-100 text-slate-500"}`}>
                              {STATUS_LABEL[job.status] ?? job.status}
                            </span>
                            {job.property?.cleaningFee ? (
                              <span className="font-semibold text-slate-900">{formatCurrency(job.property.cleaningFee)}</span>
                            ) : null}
                          </div>
                        </div>
                        <p className="text-xs text-blue-500 mt-2 group-hover:underline">Click to open job →</p>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    <p className="text-sm">No jobs scheduled</p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
