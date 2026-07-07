"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/layout/Providers"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/Card"
import { Spinner } from "@/components/ui/Spinner"
import { Avatar } from "@/components/ui/Avatar"
import { formatDate } from "@/lib/utils"
import { ShoppingCart, CheckCircle2, Building2, ChevronRight, Package, Truck } from "lucide-react"
import { motion } from "framer-motion"
import type { SupplyRequest } from "@/types"

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  PENDING:   { label: "Pending",   className: "bg-amber-100 text-amber-700",   icon: <ShoppingCart className="w-3.5 h-3.5" /> },
  ORDERED:   { label: "Ordered",   className: "bg-blue-100 text-blue-700",     icon: <Package className="w-3.5 h-3.5" /> },
  DELIVERED: { label: "Delivered", className: "bg-emerald-100 text-emerald-700", icon: <Truck className="w-3.5 h-3.5" /> },
}

const FILTERS = ["ALL", "PENDING", "ORDERED", "DELIVERED"]

export default function SupplyRequestsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const isAdmin = user?.role === "ADMIN"
  const [requests, setRequests] = useState<SupplyRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("ALL")

  useEffect(() => {
    const url = filter === "ALL" ? "/api/supply-requests" : `/api/supply-requests?status=${filter}`
    fetch(url)
      .then((r) => r.json())
      .then((d) => setRequests(d.requests ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter])

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/supply-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: status as SupplyRequest["status"] } : r))
    }
  }

  return (
    <div className="min-h-screen">
      <Header
        title={isAdmin ? "Supply Requests" : "My Supply Requests"}
        subtitle={isAdmin ? "Supplies requested by your cleaners across all properties" : "Supplies you've requested on jobs"}
      />

      {loading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : (
        <div className="p-6 max-w-4xl">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Pending",   value: requests.filter((r) => r.status === "PENDING").length,   color: "text-amber-600" },
              { label: "Ordered",   value: requests.filter((r) => r.status === "ORDERED").length,   color: "text-blue-600" },
              { label: "Delivered", value: requests.filter((r) => r.status === "DELIVERED").length, color: "text-emerald-600" },
            ].map((s) => (
              <Card key={s.label} className="text-center">
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-sm text-slate-500 mt-1">{s.label}</p>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  filter === f
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {f === "ALL" ? "All" : STATUS_CONFIG[f]?.label ?? f}
              </button>
            ))}
          </div>

          {/* List */}
          {requests.length === 0 ? (
            <Card className="text-center py-12 text-slate-400">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-slate-200" />
              <p className="font-medium">No supply requests</p>
              <p className="text-sm mt-1">Cleaners can request supplies from any job page</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.map((req, i) => {
                const items: string[] = (() => { try { return JSON.parse(req.items) } catch { return [] } })()
                const status = STATUS_CONFIG[req.status]
                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card className="hover:border-blue-200 hover:shadow-md transition-all">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <ShoppingCart className="w-5 h-5 text-blue-500" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${status.className}`}>
                              {status.icon} {status.label}
                            </span>
                            <span className="flex items-center gap-1 text-sm text-slate-500">
                              <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="font-medium text-slate-900 truncate">{req.property?.name}</span>
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {items.map((item, idx) => (
                              <span key={idx} className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                                {item}
                              </span>
                            ))}
                          </div>

                          {req.notes && (
                            <p className="text-sm text-slate-500 italic mb-2">"{req.notes}"</p>
                          )}

                          <div className="flex items-center gap-3">
                            {req.requestedBy && (
                              <div className="flex items-center gap-1.5">
                                <Avatar name={req.requestedBy.name} size="xs" />
                                <span className="text-xs text-slate-500">{req.requestedBy.name}</span>
                              </div>
                            )}
                            <span className="text-xs text-slate-400">{formatDate(req.createdAt)}</span>
                            {req.job && (
                              <button
                                onClick={() => router.push(`/jobs/${req.job!.id}`)}
                                className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                              >
                                View Job →
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Admin actions */}
                        {isAdmin && (
                          <div className="flex-shrink-0">
                            {req.status === "PENDING" && (
                              <button
                                onClick={() => updateStatus(req.id, "ORDERED")}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 border border-blue-200 transition-colors whitespace-nowrap"
                              >
                                Mark Ordered
                              </button>
                            )}
                            {req.status === "ORDERED" && (
                              <button
                                onClick={() => updateStatus(req.id, "DELIVERED")}
                                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium px-3 py-1.5 rounded-lg hover:bg-emerald-50 border border-emerald-200 transition-colors whitespace-nowrap"
                              >
                                Mark Delivered
                              </button>
                            )}
                            {req.status === "DELIVERED" && (
                              <span className="flex items-center gap-1 text-xs text-emerald-600">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Done
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
