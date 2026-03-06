"use client"
import { Header } from "@/components/layout/Header"
import { Card, CardHeader, CardTitle } from "@/components/ui/Card"
import { StatCard } from "@/components/ui/StatCard"
import { formatCurrency, formatDate } from "@/lib/utils"
import { DollarSign, TrendingUp, Clock, Star, CheckCircle2, ArrowUpRight, Download } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/Button"

const MOCK_PAYMENTS = [
  { id: "p1", property: "Oceanview Retreat", host: "Sarah Johnson", date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1), amount: 185, status: "paid", duration: 180 },
  { id: "p2", property: "Downtown Loft", host: "Sarah Johnson", date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), amount: 120, status: "paid", duration: 120 },
  { id: "p3", property: "Beachside Bungalow", host: "Mike Thompson", date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), amount: 160, status: "paid", duration: 150 },
  { id: "p4", property: "Sunset Villa", host: "Sarah Johnson", date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), amount: 285, status: "paid", duration: 300 },
  { id: "p5", property: "Lakefront Cottage", host: "Jennifer Davis", date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), amount: 195, status: "paid", duration: 180 },
  { id: "p6", property: "Mountain Cabin", host: "Alex Thompson", date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14), amount: 220, status: "paid", duration: 240 },
  { id: "p7", property: "Oceanview Retreat", host: "Sarah Johnson", date: new Date(Date.now() + 1000 * 60 * 60 * 3), amount: 185, status: "pending", duration: 180 },
  { id: "p8", property: "Downtown Loft", host: "Sarah Johnson", date: new Date(Date.now() + 1000 * 60 * 60 * 26), amount: 120, status: "pending", duration: 120 },
]

const weeklyData = [
  { week: "Week 1", earnings: 345 },
  { week: "Week 2", earnings: 560 },
  { week: "Week 3", earnings: 405 },
  { week: "Week 4", earnings: 537 },
]

const maxEarnings = Math.max(...weeklyData.map((w) => w.earnings))

export default function EarningsPage() {
  const totalEarned = MOCK_PAYMENTS.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0)
  const pending = MOCK_PAYMENTS.filter((p) => p.status === "pending").reduce((a, p) => a + p.amount, 0)
  const totalHours = MOCK_PAYMENTS.reduce((a, p) => a + p.duration / 60, 0)
  const avgRate = totalEarned / totalHours

  return (
    <div className="min-h-screen">
      <Header
        title="Earnings"
        subtitle="Track your income and payment history"
        actions={
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        }
      />

      <div className="p-6 max-w-5xl space-y-6">
        {/* Stats */}
        <motion.div initial="hidden" animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "This Month (MTD)", value: formatCurrency(totalEarned), change: "+12% vs last month", changeType: "positive" as const, icon: DollarSign, iconColor: "text-emerald-600", iconBg: "bg-emerald-50" },
            { title: "Pending Payout", value: formatCurrency(pending), change: "Expected in 1-2 days", changeType: "neutral" as const, icon: Clock, iconColor: "text-amber-600", iconBg: "bg-amber-50" },
            { title: "Avg Hourly Rate", value: formatCurrency(avgRate), change: "Based on all jobs", changeType: "positive" as const, icon: TrendingUp, iconColor: "text-blue-600", iconBg: "bg-blue-50" },
            { title: "Jobs Completed", value: MOCK_PAYMENTS.filter((p) => p.status === "paid").length, change: "This month", changeType: "positive" as const, icon: CheckCircle2, iconColor: "text-purple-600", iconBg: "bg-purple-50" },
          ].map((stat) => (
            <motion.div key={stat.title} variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
              <StatCard {...stat} />
            </motion.div>
          ))}
        </motion.div>

        {/* Earnings chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader>
              <CardTitle>Weekly Earnings</CardTitle>
              <span className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                <ArrowUpRight className="w-4 h-4" /> +23% this month
              </span>
            </CardHeader>
            <div className="flex items-end gap-4 h-48 pt-4">
              {weeklyData.map((w) => (
                <div key={w.week} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">{formatCurrency(w.earnings)}</span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(w.earnings / maxEarnings) * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="w-full bg-blue-600 rounded-t-xl hover:bg-blue-700 transition-colors cursor-pointer"
                    style={{ minHeight: "8px" }}
                  />
                  <span className="text-xs text-slate-400">{w.week}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Payment history */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card padding="none">
            <CardHeader className="p-6 pb-0">
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <div className="divide-y divide-slate-50">
              {MOCK_PAYMENTS.map((payment) => (
                <div key={payment.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${payment.status === "paid" ? "bg-emerald-50" : "bg-amber-50"}`}>
                    <DollarSign className={`w-5 h-5 ${payment.status === "paid" ? "text-emerald-600" : "text-amber-600"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{payment.property}</p>
                    <p className="text-xs text-slate-500">{payment.host} · {payment.duration / 60}h cleaning · {formatDate(payment.date)}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${payment.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {payment.status === "paid" ? "Paid" : "Pending"}
                    </span>
                    <span className="font-bold text-slate-900">{formatCurrency(payment.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
