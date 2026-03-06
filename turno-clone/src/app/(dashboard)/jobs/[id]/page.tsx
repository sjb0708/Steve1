"use client"
import { useAuth } from "@/components/layout/Providers"
import { Header } from "@/components/layout/Header"
import { Card, CardHeader, CardTitle } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { formatCurrency, formatDateTime, formatDuration, STATUS_COLORS, STATUS_LABELS } from "@/lib/utils"
import { Building2, MapPin, Calendar, Clock, Star, CheckCircle2, Circle, ArrowLeft, MessageCircle } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useState } from "react"

// Realistic job detail mock
const JOB = {
  id: "j1",
  property: { name: "Beautiful Home with Pool Near HITS", address: "Ocala", city: "Ocala", state: "FL", bedrooms: 3, bathrooms: 2, imageUrl: "https://a0.muscache.com/im/pictures/miso/Hosting-52737175/original/352a3bee-3756-46ee-a425-f2eac8d304cb.jpeg" },
  status: "ASSIGNED",
  scheduledDate: new Date(Date.now() + 1000 * 60 * 60 * 3),
  duration: 180,
  price: 120,
  platform: "AIRBNB",
  checkoutDate: new Date(Date.now() + 1000 * 60 * 60 * 2),
  checkinDate: new Date(Date.now() + 1000 * 60 * 60 * 8),
  notes: "Please pay special attention to the master bath and kitchen. Guest left a note about the hot tub area needing extra care. Fresh flowers in the entryway vase if available.",
  cleaner: { name: "ADEL Essential Cleaning", rating: 4.97, reviewCount: 147, location: "Ocala, FL", phone: "(352) 555-0187", bio: "Professional vacation rental cleaning service specializing in Ocala and surrounding areas.", avatar: null },
  host: { name: "Sarah Johnson", rating: 4.9, reviewCount: 89, phone: "(305) 555-0142", avatar: null },
  checklistItems: [
    { id: "c1", label: "Vacuum all floors", room: "General", completed: true },
    { id: "c2", label: "Mop hard floors", room: "General", completed: true },
    { id: "c3", label: "Clean bathrooms (toilet, sink, shower/tub)", room: "Bathroom", completed: false },
    { id: "c4", label: "Replace towels and toiletries", room: "Bathroom", completed: false },
    { id: "c5", label: "Make all beds with fresh linens", room: "Bedroom", completed: false },
    { id: "c6", label: "Dust all surfaces and furniture", room: "Bedroom", completed: false },
    { id: "c7", label: "Clean kitchen counters and appliances", room: "Kitchen", completed: false },
    { id: "c8", label: "Clean inside/outside of microwave", room: "Kitchen", completed: false },
    { id: "c9", label: "Empty all trash cans", room: "General", completed: false },
    { id: "c10", label: "Wipe down mirrors and glass surfaces", room: "General", completed: false },
    { id: "c11", label: "Check and restock supplies", room: "General", completed: false },
    { id: "c12", label: "Final walkthrough and staging", room: "General", completed: false },
  ],
}

export default function JobDetailPage() {
  const { user } = useAuth()
  const isHost = user?.role !== "CLEANER"
  const [checklist, setChecklist] = useState(JOB.checklistItems)
  const [status, setStatus] = useState(JOB.status)

  const completedCount = checklist.filter((c) => c.completed).length
  const progress = Math.round((completedCount / checklist.length) * 100)

  const toggleItem = (id: string) => {
    setChecklist((prev) => prev.map((item) => item.id === id ? { ...item, completed: !item.completed } : item))
  }

  const rooms = [...new Set(checklist.map((c) => c.room))]

  return (
    <div className="min-h-screen">
      <Header
        title="Job Details"
        subtitle={JOB.property.name}
        actions={
          <Link href="/jobs">
            <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4" /> Back to Jobs</Button>
          </Link>
        }
      />

      <div className="p-6 max-w-5xl">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-5">
            {/* Property image + status */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <Card padding="none" className="overflow-hidden">
                <div className="aspect-[16/6] overflow-hidden relative">
                  <img src={JOB.property.imageUrl} alt={JOB.property.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                    <div>
                      <h2 className="text-white font-bold text-xl">{JOB.property.name}</h2>
                      <p className="text-white/80 text-sm flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />{JOB.property.address}, {JOB.property.city}, {JOB.property.state}
                      </p>
                    </div>
                    <span className={`px-3 py-1.5 text-sm font-semibold rounded-full backdrop-blur-sm ${STATUS_COLORS[status]}`}>
                      {STATUS_LABELS[status]}
                    </span>
                  </div>
                </div>

                <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Scheduled", value: formatDateTime(JOB.scheduledDate), icon: Calendar },
                    { label: "Duration", value: formatDuration(JOB.duration), icon: Clock },
                    { label: "Rate", value: formatCurrency(JOB.price), icon: Building2 },
                    { label: "Platform", value: JOB.platform, icon: Building2 },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                      <p className="font-semibold text-slate-900 text-sm">{item.value}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Notes */}
            {JOB.notes && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card>
                  <CardHeader><CardTitle>Special Instructions</CardTitle></CardHeader>
                  <p className="text-sm text-slate-600 leading-relaxed bg-amber-50 border border-amber-100 rounded-xl p-4">{JOB.notes}</p>
                </Card>
              </motion.div>
            )}

            {/* Checklist */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card padding="none">
                <CardHeader className="p-5 pb-0">
                  <CardTitle>Cleaning Checklist</CardTitle>
                  <span className="text-sm text-slate-500">{completedCount}/{checklist.length} complete</span>
                </CardHeader>

                {/* Progress bar */}
                <div className="px-5 pb-4">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-full rounded-full ${progress === 100 ? "bg-emerald-500" : "bg-blue-600"}`}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{progress}% complete</p>
                </div>

                {rooms.map((room) => (
                  <div key={room} className="border-t border-slate-50">
                    <div className="px-5 py-2 bg-slate-50">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{room}</p>
                    </div>
                    {checklist.filter((c) => c.room === room).map((item) => (
                      <button key={item.id} onClick={() => toggleItem(item.id)}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left">
                        {item.completed
                          ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                          : <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" />}
                        <span className={`text-sm ${item.completed ? "line-through text-slate-400" : "text-slate-700"}`}>
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Cleaner info */}
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <Card>
                <p className="text-sm font-semibold text-slate-500 mb-4">{isHost ? "Assigned Cleaner" : "Property Host"}</p>
                {isHost ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={JOB.cleaner.name} size="lg" />
                      <div>
                        <p className="font-bold text-slate-900">{JOB.cleaner.name}</p>
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span className="font-medium text-slate-900">{JOB.cleaner.rating}</span>
                          <span className="text-slate-400">({JOB.cleaner.reviewCount})</span>
                        </div>
                        <p className="text-xs text-slate-500">{JOB.cleaner.location}</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-3">{JOB.cleaner.bio}</p>
                    <Button variant="outline" size="sm" className="w-full">
                      <MessageCircle className="w-4 h-4" /> Message
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Avatar name={JOB.host.name} size="lg" />
                    <div>
                      <p className="font-bold text-slate-900">{JOB.host.name}</p>
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span>{JOB.host.rating}</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Timeline */}
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Card>
                <CardTitle className="mb-4">Timeline</CardTitle>
                <div className="space-y-4">
                  {[
                    { label: "Guest checkout", time: JOB.checkoutDate, color: "bg-rose-400" },
                    { label: "Cleaning starts", time: JOB.scheduledDate, color: "bg-blue-500" },
                    { label: "Next check-in", time: JOB.checkinDate, color: "bg-emerald-400" },
                  ].map((event, i) => (
                    <div key={event.label} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${event.color}`} />
                        {i < 2 && <div className="w-0.5 h-8 bg-slate-200 mt-1" />}
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">{event.label}</p>
                        <p className="text-sm font-semibold text-slate-900">{formatDateTime(event.time!)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Actions */}
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <Card>
                <CardTitle className="mb-4">Actions</CardTitle>
                <div className="space-y-2">
                  {!isHost && status === "ASSIGNED" && (
                    <Button className="w-full" onClick={() => setStatus("IN_PROGRESS")}>
                      Start Cleaning
                    </Button>
                  )}
                  {!isHost && status === "IN_PROGRESS" && (
                    <Button className="w-full" variant="primary"
                      onClick={() => setStatus("COMPLETED")}
                      disabled={progress < 100}>
                      {progress < 100 ? `Complete checklist first (${progress}%)` : "Mark as Complete"}
                    </Button>
                  )}
                  {isHost && status === "OPEN" && (
                    <Button className="w-full">
                      Find a Cleaner
                    </Button>
                  )}
                  {isHost && status === "COMPLETED" && (
                    <Button className="w-full" variant="secondary">
                      <Star className="w-4 h-4" /> Leave Review
                    </Button>
                  )}
                  <Button variant="outline" className="w-full" size="sm">View Property</Button>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
