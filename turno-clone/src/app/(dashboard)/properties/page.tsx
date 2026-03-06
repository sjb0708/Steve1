"use client"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { Building2, MapPin, Bed, Bath, ArrowRight, Plus, Calendar, DollarSign, ExternalLink } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

const MOCK_PROPERTIES = [
  {
    id: "p1",
    name: "Beautiful Home with Pool Near HITS",
    address: "Ocala",
    city: "Ocala",
    state: "FL",
    bedrooms: 3,
    bathrooms: 2,
    cleaningRate: 120,
    cleaningDuration: 180,
    platforms: ["AIRBNB", "VRBO"],
    imageUrl: "https://a0.muscache.com/im/pictures/miso/Hosting-52737175/original/352a3bee-3756-46ee-a425-f2eac8d304cb.jpeg",
    nextClean: new Date(Date.now() + 1000 * 60 * 60 * 3),
    jobsThisMonth: 8,
    revenue: 960,
    description: "A 3 bedroom, 2 bath updated home near HITS and Ocala's beautiful horse farms. Features a private swimming pool, one block from shopping and dining. 30 minutes from Juniper Springs and Silver Springs, one hour from Daytona Beach and Disney World.",
  },
  {
    id: "p2",
    name: "Spacious Home with Pool Near HITS",
    address: "Ocala",
    city: "Ocala",
    state: "FL",
    bedrooms: 3,
    bathrooms: 2,
    cleaningRate: 225,
    cleaningDuration: 180,
    platforms: ["AIRBNB", "VRBO"],
    imageUrl: "https://a0.muscache.com/im/pictures/miso/Hosting-695420530010391352/original/c1195768-6c08-431d-976d-056310e0c2c7.jpeg",
    nextClean: new Date(Date.now() + 1000 * 60 * 60 * 26),
    jobsThisMonth: 6,
    revenue: 1350,
    description: "Newly updated mid-century home with amazing architectural design. Features a full bar area, patio with games, and swimming pool. Minutes from Silver Springs and Downtown Ocala, near HITS and WEC. One hour from Daytona Beach, Disney World, and Orlando.",
  },
]

export default function PropertiesPage() {
  return (
    <div className="min-h-screen">
      <Header
        title="Properties"
        subtitle={`${MOCK_PROPERTIES.length} properties managed`}
        actions={
          <Link href="/properties/new">
            <Button size="sm">
              <Plus className="w-4 h-4" /> Add Property
            </Button>
          </Link>
        }
      />

      <div className="p-6 max-w-7xl">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total Properties", value: MOCK_PROPERTIES.length, icon: Building2, color: "text-blue-600 bg-blue-50" },
            { label: "Jobs This Month", value: MOCK_PROPERTIES.reduce((a, p) => a + p.jobsThisMonth, 0), icon: Calendar, color: "text-purple-600 bg-purple-50" },
            { label: "Monthly Revenue", value: formatCurrency(MOCK_PROPERTIES.reduce((a, p) => a + p.revenue, 0)), icon: DollarSign, color: "text-emerald-600 bg-emerald-50" },
          ].map((s) => (
            <Card key={s.label} className="animate-fade-in">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Property grid */}
        <motion.div initial="hidden" animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {MOCK_PROPERTIES.map((prop) => (
            <motion.div key={prop.id} variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
              <Link href={`/properties/${prop.id}`}>
                <Card padding="none" hover className="overflow-hidden">
                  {/* Image */}
                  <div className="aspect-[16/10] overflow-hidden relative">
                    <img src={prop.imageUrl} alt={prop.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      {prop.platforms.map((p) => (
                        <span key={p} className={`px-2.5 py-1 text-xs font-semibold rounded-full ${p === "AIRBNB" ? "bg-rose-500 text-white" : "bg-blue-600 text-white"}`}>
                          {p}
                        </span>
                      ))}
                    </div>
                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-white/90 text-slate-700">
                        Next: {formatDateShort(prop.nextClean)}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-slate-900">{prop.name}</h3>
                      <ExternalLink className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
                    </div>
                    <div className="flex items-center gap-1 text-slate-500 text-sm mb-3">
                      <MapPin className="w-3.5 h-3.5" />
                      {prop.city}, {prop.state}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                      <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" />{prop.bedrooms} bed</span>
                      <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{prop.bathrooms} bath</span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <div>
                        <p className="text-xs text-slate-400">Cleaning rate</p>
                        <p className="font-semibold text-slate-900">{formatCurrency(prop.cleaningRate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Jobs this month</p>
                        <p className="font-semibold text-slate-900">{prop.jobsThisMonth}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Revenue</p>
                        <p className="font-semibold text-emerald-600">{formatCurrency(prop.revenue)}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}

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
