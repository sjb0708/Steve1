"use client"
import { useState } from "react"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import { Modal } from "@/components/ui/Modal"
import { useAuth } from "@/components/layout/Providers"
import { formatCurrency } from "@/lib/utils"
import { Star, MapPin, Clock, Search, Briefcase, CheckCircle2, MessageCircle, Filter } from "lucide-react"
import { motion } from "framer-motion"

const MOCK_CLEANERS = [
  {
    id: "c1", name: "ADEL Essential Cleaning Services", location: "Ocala, FL", rating: 4.97, reviewCount: 147,
    hourlyRate: 28, completedJobs: 312, bio: "Professional vacation rental cleaning service based in Ocala, FL. We specialize in Airbnb and VRBO turnovers, paying close attention to every detail to ensure guests have a 5-star experience. Background checked, insured, and available weekdays and weekends.",
    skills: ["Deep Clean", "Airbnb Specialist", "Pool Area", "Laundry"],
    responseTime: "< 30 min", verified: true, available: true,
    avatar: null, joinedYear: 2019,
  },
  {
    id: "c2", name: "Judith Spring Cleaning", location: "Ocala, FL", rating: 4.92, reviewCount: 98,
    hourlyRate: 26, completedJobs: 205, bio: "Dedicated vacation rental cleaning professional serving the Ocala area. Certified in hospitality standards with a passion for fresh, spotless spaces. Reliable, punctual, and thorough on every job. Available Mon-Sat.",
    skills: ["Quick Turnovers", "Eco-Friendly", "Airbnb Specialist", "Laundry"],
    responseTime: "< 1 hour", verified: true, available: true,
    avatar: null, joinedYear: 2020,
  },
]

const MOCK_OPEN_JOBS = [
  {
    id: "j3", property: "Beautiful Home with Pool Near HITS", city: "Ocala, FL", scheduledDate: new Date(Date.now() + 1000 * 60 * 60 * 50),
    duration: 180, price: 120, bedrooms: 3, bathrooms: 2, platform: "AIRBNB", host: "Sarah Johnson",
  },
  {
    id: "j8", property: "Spacious Home with Pool Near HITS", city: "Ocala, FL", scheduledDate: new Date(Date.now() + 1000 * 60 * 60 * 18),
    duration: 180, price: 225, bedrooms: 3, bathrooms: 2, platform: "VRBO", host: "Sarah Johnson",
  },
]

export default function MarketplacePage() {
  const { user } = useAuth()
  const isHost = user?.role !== "CLEANER"
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<typeof MOCK_CLEANERS[0] | null>(null)
  const [hiringJobId, setHiringJobId] = useState<string | null>(null)

  const filtered = MOCK_CLEANERS.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.location.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen">
      <Header
        title={isHost ? "Find Cleaners" : "Available Jobs"}
        subtitle={isHost ? "Browse vetted cleaning professionals near you" : "Browse open cleaning jobs in your area"}
      />

      <div className="p-6 max-w-6xl space-y-6">
        {/* Search */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={isHost ? "Search cleaners by name or location..." : "Search jobs by property..."}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300 transition-all" />
          </div>
          <Button variant="outline">
            <Filter className="w-4 h-4" /> Filters
          </Button>
        </div>

        {isHost ? (
          // Cleaner cards for hosts
          <motion.div initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((cleaner) => (
              <motion.div key={cleaner.id} variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
                <Card hover padding="none" className="cursor-pointer" onClick={() => setSelected(cleaner)}>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar name={cleaner.name} size="lg" />
                          {cleaner.verified && (
                            <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{cleaner.name}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{cleaner.location}
                          </p>
                        </div>
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${cleaner.available ? "bg-emerald-400" : "bg-slate-300"}`} />
                    </div>

                    <p className="text-sm text-slate-600 line-clamp-2 mb-4">{cleaner.bio}</p>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {cleaner.skills.slice(0, 3).map((skill) => (
                        <span key={skill} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">{skill}</span>
                      ))}
                      {cleaner.skills.length > 3 && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full">+{cleaner.skills.length - 3}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        <span className="font-semibold text-slate-900">{cleaner.rating}</span>
                        <span className="text-slate-400">({cleaner.reviewCount})</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">{formatCurrency(cleaner.hourlyRate)}<span className="text-xs font-normal text-slate-400">/hr</span></p>
                        <p className="text-xs text-slate-400">{cleaner.completedJobs} jobs done</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 pb-5">
                    <Button className="w-full" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(cleaner) }}>
                      View Profile & Hire
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          // Job cards for cleaners
          <motion.div initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
            className="space-y-4">
            {MOCK_OPEN_JOBS.map((job) => (
              <motion.div key={job.id} variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
                <Card hover padding="none">
                  <div className="flex items-center gap-5 p-5">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-slate-900">{job.property}</p>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${job.platform === "AIRBNB" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"}`}>{job.platform}</span>
                      </div>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mb-3"><MapPin className="w-3.5 h-3.5" />{job.city}</p>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" />{job.bedrooms}bd/{job.bathrooms}ba</span>
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{job.duration / 60} hours</span>
                        <span>by {job.host}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <p className="text-2xl font-black text-slate-900">{formatCurrency(job.price)}</p>
                      <Button size="sm">Accept Job</Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Cleaner Profile Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} size="lg"
        title={selected?.name} description={`${selected?.location} · Member since ${selected?.joinedYear}`}>
        {selected && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar name={selected.name} size="xl" />
                  {selected.verified && (
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="font-bold text-slate-900">{selected.rating}</span>
                    <span className="text-slate-500 text-sm">({selected.reviewCount} reviews)</span>
                  </div>
                  <p className="text-slate-500 text-sm">{selected.completedJobs} jobs completed</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-slate-900">{formatCurrency(selected.hourlyRate)}<span className="text-base font-normal text-slate-400">/hr</span></p>
                <p className={`text-sm font-medium flex items-center justify-end gap-1 ${selected.available ? "text-emerald-600" : "text-slate-400"}`}>
                  <span className={`w-2 h-2 rounded-full ${selected.available ? "bg-emerald-400" : "bg-slate-300"}`} />
                  {selected.available ? "Available now" : "Currently unavailable"}
                </p>
              </div>
            </div>

            <div>
              <p className="font-semibold text-slate-900 mb-2">About</p>
              <p className="text-sm text-slate-600 leading-relaxed">{selected.bio}</p>
            </div>

            <div>
              <p className="font-semibold text-slate-900 mb-3">Specialties</p>
              <div className="flex flex-wrap gap-2">
                {selected.skills.map((skill) => (
                  <span key={skill} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-xl">{skill}</span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-xs text-slate-500 mb-1">Response time</p>
                <p className="font-semibold text-slate-900 flex items-center gap-1.5"><Clock className="w-4 h-4 text-blue-600" />{selected.responseTime}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-xs text-slate-500 mb-1">Completed jobs</p>
                <p className="font-semibold text-slate-900 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" />{selected.completedJobs} jobs</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <Button variant="outline" className="flex-1">
                <MessageCircle className="w-4 h-4" /> Message
              </Button>
              <Button className="flex-1">
                Hire for a Job
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
