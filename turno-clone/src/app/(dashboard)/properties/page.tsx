"use client"
import { useState, useEffect } from "react"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import { formatDateShort } from "@/lib/utils"
import { Building2, MapPin, Bed, Bath, Plus, Calendar, RefreshCw, Wifi, WifiOff } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import type { Property } from "@/types"

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState("")

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then((d) => setProperties(d.properties || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const syncAll = async () => {
    setSyncing(true)
    setSyncMsg("")
    try {
      const res = await fetch("/api/bookings/sync", { method: "POST" })
      const data = await res.json()
      const total = data.results?.reduce((a: number, r: { synced: number }) => a + r.synced, 0) ?? 0
      setSyncMsg(`Synced ${total} booking(s)`)
      // Refresh properties to update lastSyncedAt
      const p = await fetch("/api/properties").then((r) => r.json())
      setProperties(p.properties || [])
    } catch {
      setSyncMsg("Sync failed")
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(""), 4000)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  )

  return (
    <div className="min-h-screen">
      <Header
        title="Properties"
        subtitle={`${properties.length} propert${properties.length === 1 ? "y" : "ies"}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={syncAll} loading={syncing}>
              <RefreshCw className="w-4 h-4" />
              {syncing ? "Syncing..." : "Sync iCal"}
            </Button>
            <Link href="/properties/new">
              <Button size="sm">
                <Plus className="w-4 h-4" /> Add Property
              </Button>
            </Link>
          </div>
        }
      />

      {syncMsg && (
        <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          {syncMsg}
        </div>
      )}

      <div className="p-6 max-w-7xl">
        {/* Summary row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total Properties", value: properties.length, icon: Building2, color: "text-blue-600 bg-blue-50", href: null },
            { label: "Active Jobs", value: properties.reduce((a, p) => a + (p.jobs?.length || 0), 0), icon: Calendar, color: "text-purple-600 bg-purple-50", href: "/jobs" },
            { label: "iCal Connected", value: properties.filter((p) => p.airbnbIcalUrl || p.vrboIcalUrl).length, icon: Wifi, color: "text-emerald-600 bg-emerald-50", href: null },
          ].map((s) => (
            <Card key={s.label}>
              {s.href ? (
                <Link href={s.href}>
                  <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                      <s.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                      <p className="text-xs text-slate-500">{s.label}</p>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                    <s.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Property grid */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          className="grid md:grid-cols-2 xl:grid-cols-3 gap-5"
        >
          {properties.map((prop) => {
            const nextJob = prop.jobs?.[0]
            const hasIcal = prop.airbnbIcalUrl || prop.vrboIcalUrl
            return (
              <motion.div key={prop.id} variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
                <Link href={`/properties/${prop.id}`}>
                  <Card padding="none" hover className="overflow-hidden">
                    {/* Image / placeholder */}
                    <div className="aspect-[16/10] overflow-hidden relative bg-slate-100">
                      {prop.imageUrl ? (
                        <img
                          src={prop.imageUrl}
                          alt={prop.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="w-12 h-12 text-slate-300" />
                        </div>
                      )}
                      {/* Platform badges */}
                      <div className="absolute top-3 left-3 flex gap-1.5">
                        {prop.airbnbIcalUrl && (
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500 text-white">Airbnb</span>
                        )}
                        {prop.vrboIcalUrl && (
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-600 text-white">VRBO</span>
                        )}
                      </div>
                      {nextJob && (
                        <div className="absolute top-3 right-3">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-white/90 text-slate-700">
                            Next: {formatDateShort(nextJob.scheduledDate)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-5">
                      <h3 className="font-bold text-slate-900 mb-1">{prop.name}</h3>
                      <div className="flex items-center gap-1 text-slate-500 text-sm mb-3">
                        <MapPin className="w-3.5 h-3.5" />
                        {prop.city}, {prop.state}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                        <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" />{prop.bedrooms} bed</span>
                        <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{prop.bathrooms} bath</span>
                        <span className="flex items-center gap-1 ml-auto text-xs text-slate-400">
                          {hasIcal ? (
                            <><Wifi className="w-3 h-3 text-emerald-500" /> iCal on</>
                          ) : (
                            <><WifiOff className="w-3 h-3" /> No iCal</>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <div>
                          <p className="text-xs text-slate-400">Active jobs</p>
                          <p className="font-semibold text-slate-900">{prop.jobs?.length || 0}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Clean duration</p>
                          <p className="font-semibold text-slate-900">{prop.cleaningDuration} min</p>
                        </div>
                        {prop.lastSyncedAt && (
                          <div className="text-right">
                            <p className="text-xs text-slate-400">Last sync</p>
                            <p className="text-xs text-slate-600">{formatDateShort(prop.lastSyncedAt)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            )
          })}

          {/* Add property card */}
          <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
            <Link href="/properties/new">
              <div className="h-full min-h-[280px] flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group p-8 text-center">
                <div className="w-12 h-12 bg-slate-100 group-hover:bg-blue-100 rounded-2xl flex items-center justify-center transition-colors">
                  <Plus className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
                <div>
                  <p className="font-semibold text-slate-700 group-hover:text-blue-700 transition-colors">Add New Property</p>
                  <p className="text-sm text-slate-400 mt-1">Connect Airbnb, VRBO, or manual entry</p>
                </div>
              </div>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
