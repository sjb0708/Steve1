"use client"
import { useState } from "react"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { useAuth } from "@/components/layout/Providers"
import { formatCurrency, formatDateTime, formatDuration, STATUS_COLORS, STATUS_LABELS } from "@/lib/utils"
import { Calendar, Clock, MapPin, Filter, Search, Plus, Building2 } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

type Status = "ALL" | "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"

const MOCK_JOBS = [
  {
    id: "j1", property: "Beautiful Home with Pool Near HITS", city: "Ocala, FL", status: "ASSIGNED",
    scheduledDate: new Date(Date.now() + 1000 * 60 * 60 * 3), duration: 180, price: 120,
    platform: "AIRBNB", cleaner: { name: "ADEL Essential Cleaning", rating: 4.97, avatar: null },
    host: { name: "Sarah Johnson", avatar: null },
    checkoutDate: new Date(Date.now() + 1000 * 60 * 60 * 2),
    checkinDate: new Date(Date.now() + 1000 * 60 * 60 * 8),
  },
  {
    id: "j2", property: "Spacious Home with Pool Near HITS", city: "Ocala, FL", status: "ASSIGNED",
    scheduledDate: new Date(Date.now() + 1000 * 60 * 60 * 26), duration: 180, price: 225,
    platform: "VRBO", cleaner: { name: "Judith Spring Cleaning", rating: 4.92, avatar: null },
    host: { name: "Sarah Johnson", avatar: null },
    checkoutDate: new Date(Date.now() + 1000 * 60 * 60 * 25),
    checkinDate: new Date(Date.now() + 1000 * 60 * 60 * 33),
  },
  {
    id: "j3", property: "Beautiful Home with Pool Near HITS", city: "Ocala, FL", status: "OPEN",
    scheduledDate: new Date(Date.now() + 1000 * 60 * 60 * 50), duration: 180, price: 120,
    platform: "AIRBNB", cleaner: null,
    host: { name: "Sarah Johnson", avatar: null },
    checkoutDate: new Date(Date.now() + 1000 * 60 * 60 * 49),
    checkinDate: new Date(Date.now() + 1000 * 60 * 60 * 57),
  },
  {
    id: "j4", property: "Spacious Home with Pool Near HITS", city: "Ocala, FL", status: "IN_PROGRESS",
    scheduledDate: new Date(Date.now() - 1000 * 60 * 30), duration: 180, price: 225,
    platform: "VRBO", cleaner: { name: "Judith Spring Cleaning", rating: 4.88, avatar: null },
    host: { name: "Sarah Johnson", avatar: null },
    checkoutDate: new Date(Date.now() - 1000 * 60 * 90),
    checkinDate: new Date(Date.now() + 1000 * 60 * 240),
  },
  {
    id: "j5", property: "Beautiful Home with Pool Near HITS", city: "Ocala, FL", status: "COMPLETED",
    scheduledDate: new Date(Date.now() - 1000 * 60 * 60 * 48), duration: 180, price: 120,
    platform: "AIRBNB", cleaner: { name: "ADEL Essential Cleaning", rating: 4.94, avatar: null },
    host: { name: "Sarah Johnson", avatar: null },
    checkoutDate: new Date(Date.now() - 1000 * 60 * 60 * 50),
    checkinDate: new Date(Date.now() - 1000 * 60 * 60 * 40),
  },
  {
    id: "j6", property: "Spacious Home with Pool Near HITS", city: "Ocala, FL", status: "COMPLETED",
    scheduledDate: new Date(Date.now() - 1000 * 60 * 60 * 72), duration: 180, price: 225,
    platform: "VRBO", cleaner: { name: "Judith Spring Cleaning", rating: 4.99, avatar: null },
    host: { name: "Sarah Johnson", avatar: null },
    checkoutDate: new Date(Date.now() - 1000 * 60 * 60 * 74),
    checkinDate: new Date(Date.now() - 1000 * 60 * 60 * 64),
  },
  {
    id: "j7", property: "Beautiful Home with Pool Near HITS", city: "Ocala, FL", status: "CANCELLED",
    scheduledDate: new Date(Date.now() - 1000 * 60 * 60 * 96), duration: 180, price: 120,
    platform: "AIRBNB", cleaner: null,
    host: { name: "Sarah Johnson", avatar: null },
    checkoutDate: new Date(Date.now() - 1000 * 60 * 60 * 98),
    checkinDate: new Date(Date.now() - 1000 * 60 * 60 * 88),
  },
]

const STATUS_FILTERS: { label: string; value: Status }[] = [
  { label: "All", value: "ALL" },
  { label: "Open", value: "OPEN" },
  { label: "Assigned", value: "ASSIGNED" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
]

export default function JobsPage() {
  const { user } = useAuth()
  const isHost = user?.role !== "CLEANER"
  const [filter, setFilter] = useState<Status>("ALL")
  const [search, setSearch] = useState("")

  const filtered = MOCK_JOBS.filter((j) => {
    if (filter !== "ALL" && j.status !== filter) return false
    if (search && !j.property.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="min-h-screen">
      <Header
        title="Jobs"
        subtitle={`${filtered.length} jobs`}
        actions={
          isHost ? (
            <Link href="/jobs/new">
              <Button size="sm"><Plus className="w-4 h-4" /> New Job</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="p-6 max-w-5xl space-y-5">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs by property..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-300 transition-all" />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {STATUS_FILTERS.map((f) => (
              <button key={f.value} onClick={() => setFilter(f.value)}
                className={`px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${filter === f.value ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Job list */}
        <motion.div initial="hidden" animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          className="space-y-3">
          {filtered.map((job) => (
            <motion.div key={job.id} variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
              <Link href={`/jobs/${job.id}`}>
                <Card hover padding="none">
                  <div className="flex items-center gap-4 p-5">
                    {/* Status indicator */}
                    <div className={`w-1.5 h-16 rounded-full flex-shrink-0 ${
                      job.status === "COMPLETED" ? "bg-emerald-400" :
                      job.status === "IN_PROGRESS" ? "bg-purple-400" :
                      job.status === "ASSIGNED" ? "bg-blue-400" :
                      job.status === "OPEN" ? "bg-amber-400" : "bg-slate-300"
                    }`} />

                    {/* Property */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{job.property}</p>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <MapPin className="w-3 h-3" />{job.city}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDateTime(job.scheduledDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDuration(job.duration)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${job.platform === "AIRBNB" ? "bg-rose-100 text-rose-700" : job.platform === "VRBO" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                          {job.platform}
                        </span>
                      </div>
                    </div>

                    {/* Cleaner/Host */}
                    <div className="hidden sm:flex flex-col items-center gap-1 flex-shrink-0">
                      {isHost ? (
                        job.cleaner ? (
                          <>
                            <Avatar name={job.cleaner.name} size="sm" />
                            <p className="text-xs text-slate-600 font-medium">{job.cleaner.name.split(" ")[0]}</p>
                            <p className="text-xs text-amber-600">★ {job.cleaner.rating}</p>
                          </>
                        ) : (
                          <>
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                              <span className="text-amber-600 text-xs font-bold">?</span>
                            </div>
                            <p className="text-xs text-amber-600 font-medium">Unassigned</p>
                          </>
                        )
                      ) : (
                        <>
                          <Avatar name={job.host.name} size="sm" />
                          <p className="text-xs text-slate-600">{job.host.name.split(" ")[0]}</p>
                        </>
                      )}
                    </div>

                    {/* Price and status */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[job.status]}`}>
                        {STATUS_LABELS[job.status]}
                      </span>
                      <p className="text-lg font-bold text-slate-900">{formatCurrency(job.price)}</p>
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
    </div>
  )
}
