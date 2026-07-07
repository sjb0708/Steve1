"use client"
import { useState, useEffect } from "react"
import { useAuth } from "@/components/layout/Providers"
import { Header } from "@/components/layout/Header"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Spinner } from "@/components/ui/Spinner"
import { formatCurrency, formatDate } from "@/lib/utils"
import { differenceInDays } from "date-fns"
import {
  DollarSign, Clock, CheckCircle2, Building2, TrendingUp, AlertCircle,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

type Payment = {
  id: string
  jobId: string
  cleanerId: string
  propertyId: string
  amount: number
  status: string
  paidAt: string | null
  createdAt: string
  job: {
    scheduledDate: string
    property: { id: string; name: string; city: string; state: string }
    cleaner?: { id: string; name: string; email: string; avatarUrl?: string | null }
  }
  cleaner?: { id: string; name: string; email: string; avatarUrl?: string | null }
  property: { id: string; name: string; city: string; state: string }
}

type FilterView = "awaiting" | "this_month" | "this_year" | "all_time"

function DaysOverdue({ jobDate }: { jobDate: string }) {
  const days = differenceInDays(new Date(), new Date(jobDate))
  if (days <= 0) return null
  const color = days > 14 ? "text-red-600" : days > 7 ? "text-amber-600" : "text-slate-400"
  return <span className={`text-xs font-medium ${color}`}>{days}d since job</span>
}

function FilterCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
  active,
  onClick,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-5 border-2 transition-all shadow-sm ${
        active
          ? "border-blue-500 bg-blue-50 shadow-blue-100"
          : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-semibold mb-1 ${active ? "text-blue-600" : "text-slate-500"}`}>{label}</p>
          <p className={`text-2xl font-bold ${active ? "text-blue-700" : "text-slate-900"}`}>{value}</p>
          {sub && <p className={`text-xs mt-1 ${active ? "text-blue-500" : "text-slate-400"}`}>{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? "bg-blue-100" : iconBg}`}>
          <Icon className={`w-5 h-5 ${active ? "text-blue-600" : iconColor}`} />
        </div>
      </div>
      {active && (
        <div className="mt-3 text-xs font-semibold text-blue-600 flex items-center gap-1">
          Showing below ↓
        </div>
      )}
    </button>
  )
}

function PaymentRow({
  payment,
  showMarkPaid,
  onMarkPaid,
  loading,
}: {
  payment: Payment
  showMarkPaid?: boolean
  onMarkPaid?: (id: string) => void
  loading?: boolean
}) {
  const cleaner = payment.cleaner || payment.job?.cleaner
  const daysOld = differenceInDays(new Date(), new Date(payment.job.scheduledDate))
  const isPaid = payment.status === "PAID"

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border ${
        isPaid
          ? "bg-emerald-50 border-emerald-100"
          : "bg-amber-50 border-amber-100"
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {cleaner && <Avatar name={cleaner.name} src={cleaner.avatarUrl} size="sm" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-900 text-sm">{cleaner?.name ?? "Unknown Cleaner"}</p>
            {!isPaid && daysOld > 14 && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
                <AlertCircle className="w-3 h-3" />
                {daysOld}d overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
            <Building2 className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{payment.property.name}</span>
            <span className="text-slate-300 mx-1">·</span>
            <span>{payment.property.city}, {payment.property.state}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <p className="text-xs text-slate-400">Job: {formatDate(payment.job.scheduledDate)}</p>
            {isPaid && payment.paidAt && (
              <p className="text-xs text-emerald-600 font-medium">Paid: {formatDate(payment.paidAt)}</p>
            )}
            {!isPaid && <DaysOverdue jobDate={payment.job.scheduledDate} />}
          </div>
          {cleaner?.email && (
            <p className="text-xs text-slate-400 mt-0.5">{cleaner.email}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:flex-col sm:items-end flex-shrink-0">
        <p className="text-xl font-bold text-slate-900">{formatCurrency(payment.amount)}</p>
        {isPaid ? (
          <Badge variant="green">PAID</Badge>
        ) : showMarkPaid && onMarkPaid ? (
          <Button size="sm" loading={loading} onClick={() => onMarkPaid(payment.id)}>
            Mark Paid
          </Button>
        ) : (
          <Badge variant="amber">UNPAID</Badge>
        )}
      </div>
    </motion.div>
  )
}

function AdminPayments({
  payments,
  onMarkPaid,
  markingPaid,
}: {
  payments: Payment[]
  onMarkPaid: (id: string) => void
  markingPaid: string | null
}) {
  const [filter, setFilter] = useState<FilterView>("awaiting")

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const unpaid = payments.filter((p) => p.status === "UNPAID")
  const paid = payments.filter((p) => p.status === "PAID")

  const totalAwaiting = unpaid.reduce((s, p) => s + p.amount, 0)
  const paidThisMonthList = paid.filter((p) => p.paidAt && new Date(p.paidAt) >= startOfMonth)
  const paidThisYearList = paid.filter((p) => p.paidAt && new Date(p.paidAt) >= startOfYear)
  const paidThisMonth = paidThisMonthList.reduce((s, p) => s + p.amount, 0)
  const paidThisYear = paidThisYearList.reduce((s, p) => s + p.amount, 0)
  const totalAllTime = paid.reduce((s, p) => s + p.amount, 0)

  const filteredPayments: Payment[] =
    filter === "awaiting" ? unpaid
    : filter === "this_month" ? paidThisMonthList
    : filter === "this_year" ? paidThisYearList
    : paid

  const filterLabels: Record<FilterView, string> = {
    awaiting: "Awaiting Payment",
    this_month: "Paid This Month",
    this_year: "Paid This Year",
    all_time: "All Paid — All Time",
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Clickable filter stat cards */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <FilterCard
          label="Awaiting Payment"
          value={formatCurrency(totalAwaiting)}
          sub={`${unpaid.length} payment${unpaid.length !== 1 ? "s" : ""} pending`}
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          active={filter === "awaiting"}
          onClick={() => setFilter("awaiting")}
        />
        <FilterCard
          label="Paid This Month"
          value={formatCurrency(paidThisMonth)}
          sub={`${paidThisMonthList.length} job${paidThisMonthList.length !== 1 ? "s" : ""}`}
          icon={DollarSign}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          active={filter === "this_month"}
          onClick={() => setFilter("this_month")}
        />
        <FilterCard
          label="Paid This Year"
          value={formatCurrency(paidThisYear)}
          sub={`${paidThisYearList.length} job${paidThisYearList.length !== 1 ? "s" : ""}`}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          active={filter === "this_year"}
          onClick={() => setFilter("this_year")}
        />
        <FilterCard
          label="Total Paid All-Time"
          value={formatCurrency(totalAllTime)}
          sub={`${paid.length} completed`}
          icon={TrendingUp}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          active={filter === "all_time"}
          onClick={() => setFilter("all_time")}
        />
      </motion.div>

      {/* Filtered payment list */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{filterLabels[filter]}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {filteredPayments.length} payment{filteredPayments.length !== 1 ? "s" : ""}
              {filteredPayments.length > 0 && (
                <> · {formatCurrency(filteredPayments.reduce((s, p) => s + p.amount, 0))} total</>
              )}
            </p>
          </div>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            <p className="font-semibold text-slate-500">
              {filter === "awaiting" ? "All caught up — no pending payments!" : "No payments in this period."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredPayments.map((payment) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  showMarkPaid={filter === "awaiting"}
                  onMarkPaid={onMarkPaid}
                  loading={markingPaid === payment.id}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  )
}

function CleanerPayments({ payments }: { payments: Payment[] }) {
  const [filter, setFilter] = useState<FilterView>("awaiting")

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const unpaid = payments.filter((p) => p.status === "UNPAID")
  const paid = payments.filter((p) => p.status === "PAID")

  const paidThisMonthList = paid.filter((p) => p.paidAt && new Date(p.paidAt) >= startOfMonth)
  const paidThisYearList = paid.filter((p) => p.paidAt && new Date(p.paidAt) >= startOfYear)

  const filteredPayments: Payment[] =
    filter === "awaiting" ? unpaid
    : filter === "this_month" ? paidThisMonthList
    : filter === "this_year" ? paidThisYearList
    : paid

  const filterLabels: Record<FilterView, string> = {
    awaiting: "Pending Payment",
    this_month: "Paid This Month",
    this_year: "Paid This Year",
    all_time: "All Earnings",
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <FilterCard
          label="Pending"
          value={formatCurrency(unpaid.reduce((s, p) => s + p.amount, 0))}
          sub={`${unpaid.length} awaiting`}
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          active={filter === "awaiting"}
          onClick={() => setFilter("awaiting")}
        />
        <FilterCard
          label="This Month"
          value={formatCurrency(paidThisMonthList.reduce((s, p) => s + p.amount, 0))}
          sub={`${paidThisMonthList.length} jobs`}
          icon={DollarSign}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          active={filter === "this_month"}
          onClick={() => setFilter("this_month")}
        />
        <FilterCard
          label="This Year"
          value={formatCurrency(paidThisYearList.reduce((s, p) => s + p.amount, 0))}
          sub={`${paidThisYearList.length} jobs`}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          active={filter === "this_year"}
          onClick={() => setFilter("this_year")}
        />
        <FilterCard
          label="All-Time"
          value={formatCurrency(paid.reduce((s, p) => s + p.amount, 0))}
          sub={`${paid.length} jobs total`}
          icon={TrendingUp}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          active={filter === "all_time"}
          onClick={() => setFilter("all_time")}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{filterLabels[filter]}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {filteredPayments.length} payment{filteredPayments.length !== 1 ? "s" : ""}
              {filteredPayments.length > 0 && (
                <> · {formatCurrency(filteredPayments.reduce((s, p) => s + p.amount, 0))}</>
              )}
            </p>
          </div>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            <p className="font-semibold text-slate-500">
              {filter === "awaiting" ? "No pending payments." : "No payments in this period."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredPayments.map((p) => (
                <PaymentRow key={p.id} payment={p} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PaymentsPage() {
  const { user } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)

  const fetchPayments = () => {
    fetch("/api/payments")
      .then((r) => r.json())
      .then((d) => setPayments(d.payments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchPayments() }, [])

  const handleMarkPaid = async (id: string) => {
    setMarkingPaid(id)
    try {
      const res = await fetch(`/api/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      })
      if (res.ok) fetchPayments()
    } catch {}
    setMarkingPaid(null)
  }

  const isAdmin = user?.role === "ADMIN"
  const unpaid = payments.filter((p) => p.status === "UNPAID")
  const totalAwaiting = unpaid.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="min-h-screen">
      <Header
        title={isAdmin ? "Payments" : "My Payments"}
        subtitle={
          isAdmin
            ? unpaid.length > 0
              ? `${unpaid.length} awaiting · ${formatCurrency(totalAwaiting)} outstanding`
              : "All payments up to date"
            : "Your earnings and payment history"
        }
      />
      {loading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : isAdmin ? (
        <AdminPayments payments={payments} onMarkPaid={handleMarkPaid} markingPaid={markingPaid} />
      ) : (
        <CleanerPayments payments={payments} />
      )}
    </div>
  )
}
