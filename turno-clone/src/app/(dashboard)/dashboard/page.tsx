"use client"
import { useEffect, useState } from "react"
import { useAuth } from "@/components/layout/Providers"
import { Header } from "@/components/layout/Header"
import { StatCard } from "@/components/ui/StatCard"
import { Card, CardHeader, CardTitle } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import { formatDateShort, formatTime, formatDate, STATUS_COLORS, STATUS_LABELS } from "@/lib/utils"
import type { Job } from "@/types"
import {
  Building2, Briefcase, Calendar, ArrowRight,
  Clock, CheckCircle2, AlertCircle, Users, ChevronRight, TriangleAlert, ShoppingCart,
} from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

interface DashStats {
  totalProperties: number
  unassignedJobs: number
  assignedJobs: number
  upcomingThisWeek: number
  openIssues: number
  pendingSupplies: number
}

function greeting(name: string) {
  const h = new Date().getHours()
  const salutation = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
  return `${salutation}, ${name}`
}

// ─── Admin dashboard ──────────────────────────────────────────────────────────

function AdminDashboard() {
  const [stats, setStats] = useState<DashStats | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, jobsRes] = await Promise.all([
          fetch("/api/dashboard/stats"),
          fetch("/api/jobs?limit=5"),
        ])
        if (statsRes.ok) setStats(await statsRes.json())
        if (jobsRes.ok) {
          const data = await jobsRes.json()
          setJobs(data.jobs ?? data)
        }
      } catch {
        // silently fail — empty states will show
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

  const statCards = [
    {
      title: "Total Properties",
      value: stats?.totalProperties?.toString() ?? "—",
      icon: Building2,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      change: "Managed properties",
      changeType: "neutral" as const,
    },
    {
      title: "Unassigned Jobs",
      value: stats?.unassignedJobs?.toString() ?? "—",
      icon: AlertCircle,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
      change: stats?.unassignedJobs ? "Need cleaner assigned" : "All covered",
      changeType: (stats?.unassignedJobs ? "negative" : "positive") as "negative" | "positive",
    },
    {
      title: "Assigned Jobs",
      value: stats?.assignedJobs?.toString() ?? "—",
      icon: Briefcase,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      change: "Cleaners confirmed",
      changeType: "positive" as const,
    },
    {
      title: "This Week",
      value: stats?.upcomingThisWeek?.toString() ?? "—",
      icon: Calendar,
      iconColor: "text-purple-600",
      iconBg: "bg-purple-50",
      change: "Upcoming cleanings",
      changeType: "neutral" as const,
    },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Stats */}
      <motion.div initial="hidden" animate="visible" variants={stagger}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <motion.div key={s.title} variants={fadeUp}>
            <StatCard {...s} />
          </motion.div>
        ))}
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upcoming jobs */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }} className="lg:col-span-2">
          <Card padding="none">
            <CardHeader className="p-6 pb-0">
              <CardTitle>Upcoming Jobs</CardTitle>
              <Link href="/jobs"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <div className="divide-y divide-slate-50 mt-4">
              {jobs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No upcoming jobs
                </div>
              ) : (
                jobs.map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">
                        {job.property?.name ?? "Property"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {job.cleaner ? job.cleaner.name : "No cleaner assigned"}
                        {" · "}
                        {formatDateShort(job.scheduledDate)}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${STATUS_COLORS[job.status]}`}>
                      {STATUS_LABELS[job.status]}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </motion.div>

        {/* Quick links */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }} className="space-y-4">
          <Card padding="none">
            <CardHeader className="p-5 pb-3">
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0 space-y-2">
              {[
                { href: "/bookings", icon: Calendar, label: "Manage Bookings", desc: "View & sync reservations", color: "bg-blue-50 text-blue-600" },
                { href: "/users", icon: Users, label: "Team Members", desc: "Approve & manage cleaners", color: "bg-purple-50 text-purple-600" },
                { href: "/jobs", icon: Briefcase, label: "All Jobs", desc: "View and assign jobs", color: "bg-emerald-50 text-emerald-600" },
              ].map((link) => (
                <Link key={link.href} href={link.href}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${link.color}`}>
                    <link.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{link.label}</p>
                    <p className="text-xs text-slate-500">{link.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </Link>
              ))}
            </div>
          </Card>

          {stats?.unassignedJobs ? (
            <Card className="bg-amber-50 border-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    {stats.unassignedJobs} job{stats.unassignedJobs !== 1 ? "s" : ""} unassigned
                  </p>
                  <p className="text-xs text-amber-700 mt-1">Assign a cleaner to keep your schedule on track.</p>
                  <Link href="/jobs">
                    <Button size="sm" className="mt-3">Assign Now</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ) : null}

          {stats?.openIssues ? (
            <Card className="bg-red-50 border-red-200">
              <div className="flex items-start gap-3">
                <TriangleAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-900">
                    {stats.openIssues} open issue{stats.openIssues !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-red-700 mt-1">Your cleaners have reported damage or issues that need attention.</p>
                  <Link href="/issues">
                    <Button size="sm" className="mt-3 bg-red-600 hover:bg-red-700">Review Issues</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ) : null}

          {stats?.pendingSupplies ? (
            <Card className="bg-blue-50 border-blue-200">
              <div className="flex items-start gap-3">
                <ShoppingCart className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    {stats.pendingSupplies} supply request{stats.pendingSupplies !== 1 ? "s" : ""} pending
                  </p>
                  <p className="text-xs text-blue-700 mt-1">Your cleaners need supplies restocked at one or more properties.</p>
                  <Link href="/supply-requests">
                    <Button size="sm" className="mt-3 bg-blue-600 hover:bg-blue-700">Review Requests</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ) : null}
        </motion.div>
      </div>
    </div>
  )
}

// ─── Cleaner dashboard ────────────────────────────────────────────────────────

function CleanerDashboard() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/jobs?limit=10")
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

  const upcoming = jobs.filter((j) => ["PENDING_ACCEPTANCE", "ASSIGNED", "IN_PROGRESS"].includes(j.status))

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {upcoming.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="text-center py-16">
          <CheckCircle2 className="w-14 h-14 mx-auto mb-4 text-slate-200" />
          <p className="text-lg font-semibold text-slate-700">No upcoming jobs</p>
          <p className="text-sm text-slate-500 mt-1">You're all caught up for now.</p>
        </motion.div>
      ) : (
        <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-3">
          {upcoming.map((job) => {
            const items = job.checklistItems ?? []
            const done = items.filter((c) => c.completed).length
            const pct = items.length ? Math.round((done / items.length) * 100) : 0
            const isSameDay =
              job.booking?.checkIn &&
              new Date(job.booking.checkIn).toDateString() === new Date(job.scheduledDate).toDateString()

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
                      {isSameDay && (
                        <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <span className="text-xs font-semibold text-amber-700">Same-day turnover</span>
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 text-base leading-tight truncate">
                            {job.property?.name ?? "Property"}
                          </p>
                          <p className="text-sm text-slate-500 mt-1">
                            {job.property?.address ? `${job.property.city}, ${job.property.state}` : ""}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${STATUS_COLORS[job.status]}`}>
                          {STATUS_LABELS[job.status]}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">{formatDateShort(job.scheduledDate)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>{formatTime(job.scheduledDate)}</span>
                        </div>
                      </div>

                      {items.length > 0 && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-slate-500">Checklist progress</span>
                            <span className="text-xs font-semibold text-slate-700">{done}/{items.length}</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-50 px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-slate-500">
                        {job.booking ? `Check-out: ${formatTime(job.scheduledDate)}` : "View details"}
                      </span>
                      <span className="text-sm font-semibold text-blue-600 flex items-center gap-1">
                        Open <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <Link href="/jobs">
          <Button variant="outline" className="w-full mt-2">
            View all jobs <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </motion.div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "ADMIN"
  const firstName = user?.name?.split(" ")[0] ?? "there"

  return (
    <div className="min-h-screen">
      <Header
        title={greeting(firstName)}
        subtitle={
          isAdmin
            ? "Here's what's happening with your properties today."
            : "Here are your upcoming cleaning jobs."
        }
      />
      {isAdmin ? <AdminDashboard /> : <CleanerDashboard />}
    </div>
  )
}
