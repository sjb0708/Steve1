"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import { formatCurrency } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Building2, Clock, User } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, addDays, subDays } from "date-fns"
import { motion } from "framer-motion"
import type { Job, Booking } from "@/types"

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

const BAR_ROW_HEIGHT = 24
const HEADER_ROW_HEIGHT = 34

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/jobs?limit=200").then((r) => r.json()).then((d) => setJobs(d.jobs || [])),
      fetch("/api/bookings").then((r) => (r.ok ? r.json() : { bookings: [] })).then((d) => setBookings(d.bookings || [])),
    ])
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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
    jobs.filter((j) => j.status !== "CANCELLED" && isSameDay(new Date(j.scheduledDate), date))

  const getBookingEventsForDay = (date: Date) => {
    const events: { booking: Booking; type: "IN" | "OUT" }[] = []
    for (const b of bookings) {
      if (isSameDay(new Date(b.checkIn), date)) events.push({ booking: b, type: "IN" })
      if (isSameDay(new Date(b.checkOut), date)) events.push({ booking: b, type: "OUT" })
    }
    return events
  }

  const selectedDayJobs = selectedDay ? getJobsForDay(selectedDay) : []
  const selectedDayBookingEvents = selectedDay ? getBookingEventsForDay(selectedDay) : []

  const monthJobs = jobs.filter((j) => isSameMonth(new Date(j.scheduledDate), currentMonth))
  const monthRevenue = monthJobs
    .filter((j) => j.status !== "CANCELLED")
    .reduce((a, j) => a + (j.property?.cleaningFee ?? 0), 0)

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
        <div className="p-6 max-w-7xl">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Calendar grid */}
            <div className="lg:col-span-2">
              <Card padding="none">
                <div className="grid grid-cols-7 border-b border-slate-100">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="p-3 text-center text-xs font-semibold text-slate-400">{d}</div>
                  ))}
                </div>

                <div>
                  {weeks.map((week) => {
                    const { segments, laneCount } = buildWeekSegments(week, bookings)
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
                                className={`px-1.5 pt-1.5 border-r border-slate-50 cursor-pointer transition-colors flex items-start justify-between
                                  ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"}
                                  ${!inMonth ? "opacity-40" : ""}`}
                                style={{ height: HEADER_ROW_HEIGHT }}>
                                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium transition-colors
                                  ${isCurrentDay ? "bg-blue-600 text-white" : isSelected ? "bg-blue-100 text-blue-700" : "text-slate-700"}`}>
                                  {format(day, "d")}
                                </span>
                                {checkoutJob && (
                                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${STATUS_DOT[checkoutJob.status]}`} title={STATUS_LABEL[checkoutJob.status]} />
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
                              className={`absolute flex items-center px-2 h-5 text-[11px] font-medium text-white bg-indigo-700/90 hover:bg-indigo-800 truncate transition-colors
                                ${seg.continuesLeft ? "" : "rounded-l-full"}
                                ${seg.continuesRight ? "" : "rounded-r-full"}`}
                              style={{
                                top: seg.lane * BAR_ROW_HEIGHT,
                                left: `calc(${(seg.startFrac / 7) * 100}% + ${seg.continuesLeft ? 0 : 2}px)`,
                                width: `calc(${((seg.endFrac - seg.startFrac) / 7) * 100}% - ${(seg.continuesLeft ? 0 : 2) + (seg.continuesRight ? 0 : 2)}px)`,
                              }}
                            >
                              {seg.booking.guestName ?? "Reserved"} · {seg.booking.property?.name?.split(" ")[0] ?? ""}
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
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-3.5 h-2 rounded-full bg-indigo-700/90" />
                  Guest stay (bar spans check-in to checkout)
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-xs text-slate-400">Cleaning status, shown as a dot on checkout day:</span>
                  {[
                    { color: "bg-amber-400", label: "Needs Cleaner" },
                    { color: "bg-purple-400", label: "Awaiting Confirmation" },
                    { color: "bg-blue-500", label: "Assigned" },
                    { color: "bg-orange-500", label: "In Progress" },
                    { color: "bg-emerald-500", label: "Completed" },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center gap-1.5 text-sm text-slate-600">
                      <span className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                      {l.label}
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

              {/* Month summary */}
              <Card>
                <p className="font-semibold text-slate-900 mb-4">This Month</p>
                <div className="space-y-3">
                  {[
                    { label: "Total jobs", value: monthJobs.length },
                    { label: "Completed", value: monthJobs.filter((j) => j.status === "COMPLETED").length },
                    { label: "Needs cleaner", value: monthJobs.filter((j) => j.status === "UNASSIGNED").length },
                    { label: "Revenue", value: formatCurrency(monthRevenue) },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{row.label}</span>
                      <span className="font-semibold text-slate-900">{row.value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
