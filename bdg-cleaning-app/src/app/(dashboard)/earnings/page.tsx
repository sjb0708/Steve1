"use client"
import { useEffect, useState } from "react"
import { Header } from "@/components/layout/Header"
import { Card, CardHeader, CardTitle } from "@/components/ui/Card"
import { StatCard } from "@/components/ui/StatCard"
import { Spinner } from "@/components/ui/Spinner"
import { formatCurrency, formatDate } from "@/lib/utils"
import { DollarSign, Clock, CheckCircle2 } from "lucide-react"
import { motion } from "framer-motion"

type Payment = {
  id: string
  amount: number
  status: string
  paidAt: string | null
  createdAt: string
  job: { scheduledDate: string; property: { name: string } }
}

export default function EarningsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/payments")
      .then((r) => r.json())
      .then((d) => setPayments(d.payments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const paid = payments.filter((p) => p.status === "PAID")
  const pending = payments.filter((p) => p.status === "UNPAID")
  const totalEarned = paid.reduce((a, p) => a + p.amount, 0)
  const totalPending = pending.reduce((a, p) => a + p.amount, 0)

  return (
    <div className="min-h-screen">
      <Header title="Earnings" subtitle="Your payment history" />

      {loading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : (
        <div className="p-4 max-w-lg mx-auto space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="Total Earned"
              value={formatCurrency(totalEarned)}
              icon={DollarSign}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50"
              change={`${paid.length} completed jobs`}
              changeType="positive"
            />
            <StatCard
              title="Pending"
              value={formatCurrency(totalPending)}
              icon={Clock}
              iconColor="text-amber-600"
              iconBg="bg-amber-50"
              change={`${pending.length} awaiting payment`}
              changeType="neutral"
            />
          </div>

          {/* Payment history */}
          <Card padding="none">
            <CardHeader className="p-5 pb-0">
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            {payments.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                <p className="text-sm">No payments yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 mt-3">
                {payments.map((payment, i) => (
                  <motion.div
                    key={payment.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-4 px-5 py-4"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${payment.status === "PAID" ? "bg-emerald-50" : "bg-amber-50"}`}>
                      <DollarSign className={`w-5 h-5 ${payment.status === "PAID" ? "text-emerald-600" : "text-amber-600"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{payment.job.property.name}</p>
                      <p className="text-xs text-slate-500">{formatDate(payment.job.scheduledDate)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${payment.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {payment.status === "PAID" ? "Paid" : "Pending"}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">{formatCurrency(payment.amount)}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
