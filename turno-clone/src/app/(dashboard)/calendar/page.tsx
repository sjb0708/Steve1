"use client"
import { useState } from "react"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/components/layout/Providers"
import { formatCurrency } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Building2, Clock } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns"
import { motion } from "framer-motion"

const MOCK_EVENTS = [
  { id: "j1", date: new Date(Date.now() + 1000 * 60 * 60 * 3), property: "Beautiful Home with Pool Near HITS", cleaner: "ADEL Essential Cleaning", status: "ASSIGNED", price: 120, duration: 180, platform: "AIRBNB" },
  { id: "j2", date: new Date(Date.now() + 1000 * 60 * 60 * 26), property: "Spacious Home with Pool Near HITS", cleaner: "Judith Spring Cleaning", status: "ASSIGNED", price: 225, duration: 180, platform: "VRBO" },
  { id: "j3", date: new Date(Date.now() + 1000 * 60 * 60 * 50), property: "Beautiful Home with Pool Near HITS", cleaner: null, status: "OPEN", price: 120, duration: 180, platform: "AIRBNB" },
  { id: "j4", date: new Date(Date.now() + 1000 * 60 * 60 * 72), property: "Spacious Home with Pool Near HITS", cleaner: "Judith Spring Cleaning", status: "ASSIGNED", price: 225, duration: 180, platform: "VRBO" },
  { id: "j5", date: new Date(Date.now() + 1000 * 60 * 60 * 120), property: "Beautiful Home with Pool Near HITS", cleaner: "ADEL Essential Cleaning", status: "ASSIGNED", price: 120, duration: 180, platform: "AIRBNB" },
  { id: "j6", date: new Date(Date.now() + 1000 * 60 * 60 * 168), property: "Spacious Home with Pool Near HITS", cleaner: "Judith Spring Cleaning", status: "ASSIGNED", price: 225, duration: 180, platform: "VRBO" },
  { id: "j7", date: new Date(Date.now() - 1000 * 60 * 60 * 48), property: "Spacious Home with Pool Near HITS", cleaner: "ADEL Essential Cleaning", status: "COMPLETED", price: 225, duration: 180, platform: "VRBO" },
  { id: "j8", date: new Date(Date.now() - 1000 * 60 * 60 * 96), property: "Beautiful Home with Pool Near HITS", cleaner: "ADEL Essential Cleaning", status: "COMPLETED", price: 120, duration: 180, platform: "AIRBNB" },
]

const STATUS_DOT: Record<string, string> = {
  OPEN: "bg-amber-400",
  ASSIGNED: "bg-blue-500",
  IN_PROGRESS: "bg-purple-500",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-slate-300",
}

export default function CalendarPage() {
  const { user } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Pad start of month
  const startPad = monthStart.getDay()
  const paddedDays = [...Array(startPad).fill(null), ...days]

  const getEventsForDay = (date: Date) =>
    MOCK_EVENTS.filter((e) => isSameDay(e.date, date))

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : []

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

      <div className="p-6 max-w-7xl">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar grid */}
          <div className="lg:col-span-2">
            <Card padding="none">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-slate-100">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="p-3 text-center text-xs font-semibold text-slate-400">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {paddedDays.map((day, i) => {
                  if (!day) return <div key={`pad-${i}`} className="min-h-[100px] border-b border-r border-slate-50" />
                  const events = getEventsForDay(day)
                  const isSelected = selectedDay && isSameDay(day, selectedDay)
                  const isCurrentDay = isToday(day)
                  const inMonth = isSameMonth(day, currentMonth)

                  return (
                    <motion.div key={day.toISOString()} whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedDay(day)}
                      className={`min-h-[100px] p-2 border-b border-r border-slate-50 cursor-pointer transition-colors
                        ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"}
                        ${!inMonth ? "opacity-30" : ""}`}>
                      <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1.5 transition-colors
                        ${isCurrentDay ? "bg-blue-600 text-white" : isSelected ? "bg-blue-100 text-blue-700" : "text-slate-700"}`}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5">
                        {events.slice(0, 3).map((ev) => (
                          <div key={ev.id}
                            className={`text-xs px-1.5 py-0.5 rounded-md truncate font-medium
                              ${ev.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                                ev.status === "OPEN" ? "bg-amber-100 text-amber-700" :
                                ev.status === "ASSIGNED" ? "bg-blue-100 text-blue-700" :
                                "bg-purple-100 text-purple-700"}`}>
                            {ev.property.split(" ")[0]}
                          </div>
                        ))}
                        {events.length > 3 && (
                          <p className="text-xs text-slate-400 pl-1">+{events.length - 3} more</p>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </Card>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4">
              {[
                { color: "bg-amber-400", label: "Open" },
                { color: "bg-blue-500", label: "Assigned" },
                { color: "bg-purple-500", label: "In Progress" },
                { color: "bg-emerald-500", label: "Completed" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-2 text-sm text-slate-600">
                  <span className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          {/* Day detail panel */}
          <div className="space-y-4">
            <Card>
              <p className="font-semibold text-slate-900 mb-4">
                {selectedDay ? format(selectedDay, "EEEE, MMMM d") : "Select a day"}
              </p>

              {selectedDayEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedDayEvents.map((ev) => (
                    <motion.div key={ev.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-pointer">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[ev.status]}`} />
                        <p className="font-semibold text-slate-900 text-sm">{ev.property}</p>
                      </div>
                      <div className="space-y-1 text-xs text-slate-500">
                        <p className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {format(ev.date, "h:mm a")} · {ev.duration / 60}h
                        </p>
                        {ev.cleaner && (
                          <p className="flex items-center gap-1.5">
                            <Building2 className="w-3 h-3" />
                            {ev.cleaner}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ev.platform === "AIRBNB" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"}`}>{ev.platform}</span>
                          <span className="font-semibold text-slate-900">{formatCurrency(ev.price)}</span>
                        </div>
                      </div>
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
                  { label: "Total jobs", value: MOCK_EVENTS.filter((e) => isSameMonth(e.date, currentMonth)).length },
                  { label: "Completed", value: MOCK_EVENTS.filter((e) => isSameMonth(e.date, currentMonth) && e.status === "COMPLETED").length },
                  { label: "Open (need cleaner)", value: MOCK_EVENTS.filter((e) => isSameMonth(e.date, currentMonth) && e.status === "OPEN").length },
                  { label: "Revenue", value: formatCurrency(MOCK_EVENTS.filter((e) => isSameMonth(e.date, currentMonth) && e.status !== "CANCELLED").reduce((a, e) => a + e.price, 0)) },
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
    </div>
  )
}
