"use client"
import { useState } from "react"
import { Header } from "@/components/layout/Header"
import { Card, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Avatar } from "@/components/ui/Avatar"
import { Textarea } from "@/components/ui/Input"
import { useAuth } from "@/components/layout/Providers"
import { User, Bell, Shield, CreditCard, Link2, Camera, Check } from "lucide-react"
import { motion } from "framer-motion"

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "security", label: "Security", icon: Shield },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("profile")
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    name: user?.name || "Sarah Johnson",
    email: user?.email || "sarah@example.com",
    phone: "(305) 555-0142",
    location: "Miami Beach, FL",
    bio: "Airbnb Superhost with 8 properties in South Florida. I love providing exceptional experiences for my guests.",
    hourlyRate: "28",
  })

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const notifSettings = [
    { label: "New job assigned", desc: "When a cleaner accepts your job request", email: true, push: true },
    { label: "Job completed", desc: "When a cleaner marks a job as complete", email: true, push: true },
    { label: "New message", desc: "When you receive a new message", email: false, push: true },
    { label: "Payment processed", desc: "When a payment is confirmed", email: true, push: false },
    { label: "Calendar sync alert", desc: "When new bookings are detected", email: true, push: true },
    { label: "Review received", desc: "When someone leaves you a review", email: true, push: false },
  ]

  return (
    <div className="min-h-screen">
      <Header title="Settings" subtitle="Manage your account preferences" />

      <div className="p-6 max-w-4xl">
        <div className="flex gap-6">
          {/* Sidebar tabs */}
          <div className="w-48 flex-shrink-0">
            <nav className="space-y-0.5">
              {TABS.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}>
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}>
              {activeTab === "profile" && (
                <div className="space-y-5">
                  <Card>
                    <CardHeader><CardTitle>Profile Photo</CardTitle></CardHeader>
                    <div className="flex items-center gap-5">
                      <div className="relative">
                        <Avatar name={form.name} size="xl" />
                        <button className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors shadow-lg">
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 mb-1">{form.name}</p>
                        <p className="text-sm text-slate-500 mb-3">{user?.role === "HOST" ? "Property Host" : "Professional Cleaner"}</p>
                        <Button variant="outline" size="sm">Upload Photo</Button>
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        <Input label="Email address" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Input label="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                        <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                      </div>
                      {user?.role === "CLEANER" && (
                        <Input label="Hourly rate ($)" type="number" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} />
                      )}
                      <Textarea label="Bio" rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
                      <Button onClick={handleSave} className="gap-2">
                        {saved ? <><Check className="w-4 h-4" /> Saved!</> : "Save Changes"}
                      </Button>
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === "notifications" && (
                <Card>
                  <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
                  <div className="space-y-1">
                    <div className="grid grid-cols-3 gap-4 pb-3 mb-3 border-b border-slate-100">
                      <span className="text-sm font-medium text-slate-700">Notification</span>
                      <span className="text-sm font-medium text-slate-500 text-center">Email</span>
                      <span className="text-sm font-medium text-slate-500 text-center">Push</span>
                    </div>
                    {notifSettings.map((n) => (
                      <div key={n.label} className="grid grid-cols-3 gap-4 py-3 border-b border-slate-50 items-center">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{n.label}</p>
                          <p className="text-xs text-slate-400">{n.desc}</p>
                        </div>
                        <div className="flex justify-center">
                          <input type="checkbox" defaultChecked={n.email}
                            className="w-4 h-4 accent-blue-600 rounded" />
                        </div>
                        <div className="flex justify-center">
                          <input type="checkbox" defaultChecked={n.push}
                            className="w-4 h-4 accent-blue-600 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button className="mt-4">Save Preferences</Button>
                </Card>
              )}

              {activeTab === "integrations" && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle>Calendar Integrations</CardTitle></CardHeader>
                    <div className="space-y-4">
                      {[
                        { name: "Airbnb", status: "connected", color: "bg-rose-100 text-rose-700", url: "airbnb.com/calendar/..." },
                        { name: "VRBO", status: "connected", color: "bg-blue-100 text-blue-700", url: "vrbo.com/ical/..." },
                        { name: "Booking.com", status: "disconnected", color: "bg-slate-100 text-slate-600", url: "" },
                        { name: "HomeAway", status: "disconnected", color: "bg-slate-100 text-slate-600", url: "" },
                      ].map((platform) => (
                        <div key={platform.name} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-xl text-sm font-bold ${platform.color}`}>{platform.name}</span>
                            {platform.url && <p className="text-xs text-slate-400 font-mono truncate max-w-[200px]">{platform.url}</p>}
                          </div>
                          <div className="flex items-center gap-3">
                            {platform.status === "connected" ? (
                              <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                                <span className="w-2 h-2 bg-emerald-400 rounded-full" />Connected
                              </span>
                            ) : (
                              <Button variant="secondary" size="sm">Connect</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === "billing" && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle>Current Plan</CardTitle></CardHeader>
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-blue-900">Professional Plan</p>
                          <p className="text-sm text-blue-600">$29/month · Renews Mar 15, 2025</p>
                        </div>
                        <Button variant="secondary" size="sm">Upgrade</Button>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      {["Up to 10 properties", "Unlimited jobs", "Calendar sync", "Priority support"].map((f) => (
                        <div key={f} className="flex items-center gap-2 text-slate-600">
                          <Check className="w-4 h-4 text-blue-600" />{f}
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>Payment Method</CardTitle></CardHeader>
                    <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200">
                      <div className="w-12 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                        <span className="text-white text-xs font-bold">VISA</span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">•••• •••• •••• 4242</p>
                        <p className="text-xs text-slate-500">Expires 09/2027</p>
                      </div>
                      <Button variant="ghost" size="sm" className="ml-auto">Update</Button>
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === "security" && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
                    <div className="space-y-4">
                      <Input label="Current password" type="password" placeholder="••••••••" />
                      <Input label="New password" type="password" placeholder="Min. 8 characters" />
                      <Input label="Confirm new password" type="password" placeholder="••••••••" />
                      <Button>Update Password</Button>
                    </div>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>Two-Factor Authentication</CardTitle></CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-700">Add an extra layer of security to your account.</p>
                        <p className="text-xs text-slate-400 mt-1">Currently disabled</p>
                      </div>
                      <Button variant="secondary" size="sm">Enable 2FA</Button>
                    </div>
                  </Card>

                  <Card className="border-red-100">
                    <CardHeader><CardTitle className="text-red-600">Danger Zone</CardTitle></CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-700">Permanently delete your account and all data.</p>
                        <p className="text-xs text-red-400 mt-1">This action cannot be undone</p>
                      </div>
                      <Button variant="danger" size="sm">Delete Account</Button>
                    </div>
                  </Card>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
