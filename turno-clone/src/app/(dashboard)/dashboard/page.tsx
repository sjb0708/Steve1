"use client"
import { useAuth } from "@/components/layout/Providers"
import { Header } from "@/components/layout/Header"
import { StatCard } from "@/components/ui/StatCard"
import { Card, CardHeader, CardTitle } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Avatar } from "@/components/ui/Avatar"
import { Button } from "@/components/ui/Button"
import { formatCurrency, formatDateShort, STATUS_COLORS, STATUS_LABELS } from "@/lib/utils"
import {
  Building2, Briefcase, DollarSign, Star, Calendar, ArrowRight,
  Clock, CheckCircle2, AlertCircle, TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

// Realistic mock data
const hostData = {
  stats: [
    { title: "Total Properties", value: "2", change: "Ocala, FL", changeType: "neutral" as const, icon: Building2, iconColor: "text-blue-600", iconBg: "bg-blue-50" },
    { title: "Active Jobs", value: "5", change: "3 today", changeType: "neutral" as const, icon: Briefcase, iconColor: "text-purple-600", iconBg: "bg-purple-50" },
    { title: "This Month", value: "$3,240", change: "+18% vs last month", changeType: "positive" as const, icon: DollarSign, iconColor: "text-emerald-600", iconBg: "bg-emerald-50" },
    { title: "Avg Rating", value: "4.9", change: "Based on 127 reviews", changeType: "positive" as const, icon: Star, iconColor: "text-amber-600", iconBg: "bg-amber-50" },
  ],
  upcomingJobs: [
    { id: "j1", property: "Beautiful Home with Pool Near HITS", cleaner: "ADEL Essential Cleaning", date: new Date(Date.now() + 1000 * 60 * 60 * 3), status: "ASSIGNED", price: 120, platform: "AIRBNB" },
    { id: "j2", property: "Spacious Home with Pool Near HITS", cleaner: "Judith Spring Cleaning", date: new Date(Date.now() + 1000 * 60 * 60 * 26), status: "ASSIGNED", price: 225, platform: "VRBO" },
    { id: "j3", property: "Beautiful Home with Pool Near HITS", cleaner: null, date: new Date(Date.now() + 1000 * 60 * 60 * 50), status: "OPEN", price: 120, platform: "AIRBNB" },
    { id: "j4", property: "Spacious Home with Pool Near HITS", cleaner: "ADEL Essential Cleaning", date: new Date(Date.now() + 1000 * 60 * 60 * 72), status: "ASSIGNED", price: 225, platform: "VRBO" },
  ],
  recentActivity: [
    { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50", text: "ADEL Essential Cleaning completed cleaning at Beautiful Home with Pool Near HITS", time: "2 hours ago" },
    { icon: Star, color: "text-amber-600 bg-amber-50", text: "New 5-star review from cleaner for Spacious Home with Pool Near HITS", time: "5 hours ago" },
    { icon: Calendar, color: "text-blue-600 bg-blue-50", text: "3 new cleanings auto-scheduled from Airbnb sync", time: "Yesterday" },
    { icon: AlertCircle, color: "text-orange-600 bg-orange-50", text: "Beautiful Home with Pool Near HITS needs a cleaner assigned", time: "Yesterday" },
  ],
  properties: [
    { name: "Beautiful Home with Pool Near HITS", city: "Ocala, FL", bedrooms: 3, nextClean: new Date(Date.now() + 1000 * 60 * 60 * 3), image: "https://a0.muscache.com/im/pictures/miso/Hosting-52737175/original/352a3bee-3756-46ee-a425-f2eac8d304cb.jpeg" },
    { name: "Spacious Home with Pool Near HITS", city: "Ocala, FL", bedrooms: 3, nextClean: new Date(Date.now() + 1000 * 60 * 60 * 26), image: "https://a0.muscache.com/im/pictures/miso/Hosting-695420530010391352/original/c1195768-6c08-431d-976d-056310e0c2c7.jpeg" },
  ],
}

const cleanerData = {
  stats: [
    { title: "Jobs This Month", value: "23", change: "+4 vs last month", changeType: "positive" as const, icon: Briefcase, iconColor: "text-blue-600", iconBg: "bg-blue-50" },
    { title: "Earnings (MTD)", value: "$1,847", change: "+12% vs last month", changeType: "positive" as const, icon: DollarSign, iconColor: "text-emerald-600", iconBg: "bg-emerald-50" },
    { title: "My Rating", value: "4.95", change: "Based on 89 reviews", changeType: "positive" as const, icon: Star, iconColor: "text-amber-600", iconBg: "bg-amber-50" },
    { title: "Completion Rate", value: "98%", change: "Excellent standing", changeType: "positive" as const, icon: TrendingUp, iconColor: "text-purple-600", iconBg: "bg-purple-50" },
  ],
  upcomingJobs: [
    { id: "j1", property: "Beautiful Home with Pool Near HITS", host: "Sarah Johnson", date: new Date(Date.now() + 1000 * 60 * 60 * 3), status: "ASSIGNED", price: 120, duration: 180 },
    { id: "j2", property: "Spacious Home with Pool Near HITS", host: "Sarah Johnson", date: new Date(Date.now() + 1000 * 60 * 60 * 26), status: "ASSIGNED", price: 225, duration: 180 },
    { id: "j3", property: "Beautiful Home with Pool Near HITS", host: "Sarah Johnson", date: new Date(Date.now() + 1000 * 60 * 60 * 72), status: "ASSIGNED", price: 120, duration: 180 },
  ],
  recentActivity: [
    { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50", text: "You completed Spacious Home with Pool Near HITS — $150 earned", time: "Yesterday" },
    { icon: Star, color: "text-amber-600 bg-amber-50", text: "Sarah Johnson left you a 5-star review", time: "Yesterday" },
    { icon: Briefcase, color: "text-blue-600 bg-blue-50", text: "New job available: Beautiful Home with Pool Near HITS — $150", time: "2 days ago" },
    { icon: DollarSign, color: "text-emerald-600 bg-emerald-50", text: "Payment of $345 deposited to your account", time: "3 days ago" },
  ],
}

export default function DashboardPage() {
  const { user } = useAuth()
  const isHost = user?.role !== "CLEANER"
  const data = isHost ? hostData : cleanerData

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  }

  return (
    <div className="min-h-screen">
      <Header
        title={`${greeting()}, ${user?.name?.split(" ")[0] || "there"} 👋`}
        subtitle={isHost ? "Here's what's happening with your properties today." : "Here's your schedule and earnings overview."}
        actions={
          <Link href={isHost ? "/properties/new" : "/marketplace"}>
            <Button size="sm">
              {isHost ? "Add Property" : "Find Jobs"}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        }
      />

      <div className="p-6 space-y-6 max-w-7xl">
        {/* Stats */}
        <motion.div initial="hidden" animate="visible" variants={stagger}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {data.stats.map((stat) => (
            <motion.div key={stat.title} variants={fadeUp}>
              <StatCard {...stat} />
            </motion.div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Upcoming Jobs */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
            <Card padding="none">
              <CardHeader className="p-6 pb-0">
                <CardTitle>Upcoming Jobs</CardTitle>
                <Link href="/jobs" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </CardHeader>
              <div className="divide-y divide-slate-50">
                {data.upcomingJobs.map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{job.property}</p>
                      <p className="text-xs text-slate-500">
                        {isHost ? `Cleaner: ${"cleaner" in job && job.cleaner ? job.cleaner : "Unassigned"}` : `Host: ${"host" in job ? job.host : ""}`}
                        {" · "}
                        <span className="flex-shrink-0">{formatDateShort(job.date)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[job.status]}`}>
                        {STATUS_LABELS[job.status]}
                      </span>
                      {job.status === "OPEN" && (
                        <span className="w-2 h-2 bg-amber-400 rounded-full status-pulse" />
                      )}
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(job.price)}</span>
                    </div>
                  </Link>
                ))}
                {data.upcomingJobs.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No upcoming jobs
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Activity feed */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card padding="none">
              <CardHeader className="p-6 pb-0">
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <div className="p-4 space-y-3">
                {data.recentActivity.map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color.split(" ")[1]}`}>
                      <item.icon className={`w-4 h-4 ${item.color.split(" ")[0]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 leading-relaxed">{item.text}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Properties quick view (hosts only) */}
        {isHost && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card padding="none">
              <CardHeader className="p-6 pb-0">
                <CardTitle>Your Properties</CardTitle>
                <Link href="/properties" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  Manage all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </CardHeader>
              <div className="p-4 grid sm:grid-cols-3 gap-4">
                {hostData.properties.map((prop) => (
                  <Link key={prop.name} href="/properties"
                    className="group rounded-2xl overflow-hidden border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all">
                    <div className="aspect-[16/9] bg-slate-100 overflow-hidden">
                      <img src={prop.image} alt={prop.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-slate-900 text-sm">{prop.name}</p>
                      <p className="text-xs text-slate-500">{prop.city}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-400">{prop.bedrooms} bed</span>
                        <span className="text-xs font-medium text-blue-600">
                          Next: {formatDateShort(prop.nextClean)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}
