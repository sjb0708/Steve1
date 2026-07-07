"use client"
import { useState, useEffect, useRef } from "react"
import { Header } from "@/components/layout/Header"
import { Card, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Avatar } from "@/components/ui/Avatar"
import { Textarea } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { useAuth } from "@/components/layout/Providers"
import { User, Bell, Shield, Link2, Camera, Check, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "security", label: "Security", icon: Shield },
]

type Property = {
  id: string
  name: string
  airbnbIcalUrl?: string | null
  vrboIcalUrl?: string | null
}

export default function SettingsPage() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState("profile")

  // Profile state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", phone: "", location: "", bio: "" })

  // Notification prefs state
  const [emailNotif, setEmailNotif] = useState(true)
  const [appNotif, setAppNotif] = useState(true)
  const [savingNotif, setSavingNotif] = useState(false)
  const [savedNotif, setSavedNotif] = useState(false)

  // Password state
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" })
  const [pwError, setPwError] = useState("")
  const [pwSaved, setPwSaved] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  // Integrations
  const [properties, setProperties] = useState<Property[]>([])
  const [loadingProps, setLoadingProps] = useState(false)

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name ?? "",
        email: user.email ?? "",
        phone: (user as { phone?: string }).phone ?? "",
        location: (user as { location?: string }).location ?? "",
        bio: (user as { bio?: string }).bio ?? "",
      })
      setAvatarUrl(user.avatarUrl ?? null)
      setEmailNotif((user as { emailNotifications?: boolean }).emailNotifications ?? true)
      setAppNotif((user as { appNotifications?: boolean }).appNotifications ?? true)
    }
  }, [user])

  useEffect(() => {
    if (activeTab === "integrations" && user?.role === "ADMIN") {
      setLoadingProps(true)
      fetch("/api/properties")
        .then((r) => r.json())
        .then((d) => setProperties(d.properties ?? []))
        .catch(() => {})
        .finally(() => setLoadingProps(false))
    }
  }, [activeTab, user])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload/avatar", { method: "POST", body: fd })
      const data = await res.json()
      if (data.avatarUrl) setAvatarUrl(data.avatarUrl)
    } catch {}
    setUploading(false)
  }

  const handleSaveProfile = async () => {
    if (!user) return
    setSaving(true)
    try {
      await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, phone: form.phone, location: form.location, bio: form.bio }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNotifications = async () => {
    if (!user) return
    setSavingNotif(true)
    try {
      await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotifications: emailNotif, appNotifications: appNotif }),
      })
      setSavedNotif(true)
      setTimeout(() => setSavedNotif(false), 2500)
    } finally {
      setSavingNotif(false)
    }
  }

  const handleChangePassword = async () => {
    setPwError("")
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) {
      setPwError("All fields are required.")
      return
    }
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError("New passwords do not match.")
      return
    }
    if (pwForm.newPw.length < 8) {
      setPwError("New password must be at least 8 characters.")
      return
    }
    setSavingPw(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.newPw }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPwError(data.error ?? "Failed to update password.")
      } else {
        setPwSaved(true)
        setPwForm({ current: "", newPw: "", confirm: "" })
        setTimeout(() => setPwSaved(false), 3000)
      }
    } catch {
      setPwError("An error occurred. Please try again.")
    } finally {
      setSavingPw(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete your account? This cannot be undone."
    )
    if (!confirmed) return
    try {
      await fetch(`/api/users/${user.id}`, { method: "DELETE" })
      await fetch("/api/auth/logout", { method: "POST" })
      window.location.href = "/login"
    } catch {}
  }

  return (
    <div className="min-h-screen">
      <Header title="Settings" subtitle="Manage your account preferences" />

      {/* Hidden file input for avatar */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarChange}
      />

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

              {/* ── PROFILE ── */}
              {activeTab === "profile" && (
                <div className="space-y-5">
                  <Card>
                    <CardHeader><CardTitle>Profile Photo</CardTitle></CardHeader>
                    <div className="flex items-center gap-5">
                      <div className="relative">
                        {uploading ? (
                          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                            <Spinner size="sm" />
                          </div>
                        ) : (
                          <Avatar name={form.name} src={avatarUrl} size="xl" />
                        )}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors shadow-lg"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 mb-1">{form.name}</p>
                        <p className="text-sm text-slate-500 mb-3">{user?.role === "ADMIN" ? "Property Host" : "Professional Cleaner"}</p>
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                          {uploading ? "Uploading…" : "Upload Photo"}
                        </Button>
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        <div>
                          <Input label="Email address" type="email" value={form.email} readOnly
                            className="bg-slate-50 cursor-not-allowed"
                            onChange={() => {}} />
                          <p className="text-xs text-slate-400 mt-1">Email cannot be changed.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Input label="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                        <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                      </div>
                      <Textarea label="Bio" rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
                      <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                        {saved ? <><Check className="w-4 h-4" /> Saved!</> : saving ? "Saving…" : "Save Changes"}
                      </Button>
                    </div>
                  </Card>
                </div>
              )}

              {/* ── NOTIFICATIONS ── */}
              {activeTab === "notifications" && (
                <Card>
                  <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500">Choose how you want to receive notifications from the app.</p>

                    <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Email Notifications</p>
                        <p className="text-xs text-slate-400 mt-0.5">Receive job updates, assignments, and alerts via email</p>
                      </div>
                      <button
                        onClick={() => setEmailNotif(!emailNotif)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${emailNotif ? "bg-blue-600" : "bg-slate-200"}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${emailNotif ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </label>

                    <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">In-App Notifications</p>
                        <p className="text-xs text-slate-400 mt-0.5">Receive notifications within the app (bell icon)</p>
                      </div>
                      <button
                        onClick={() => setAppNotif(!appNotif)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${appNotif ? "bg-blue-600" : "bg-slate-200"}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${appNotif ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </label>

                    <Button onClick={handleSaveNotifications} disabled={savingNotif} className="gap-2">
                      {savedNotif ? <><Check className="w-4 h-4" /> Saved!</> : savingNotif ? "Saving…" : "Save Preferences"}
                    </Button>
                  </div>
                </Card>
              )}

              {/* ── INTEGRATIONS ── */}
              {activeTab === "integrations" && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Calendar Integrations</CardTitle>
                      <Link href="/properties" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                        Manage in Properties <ExternalLink className="w-3 h-3" />
                      </Link>
                    </CardHeader>
                    <p className="text-sm text-slate-500 mb-4">
                      iCal integrations are configured per property. Add or update URLs on each property's settings page.
                    </p>

                    {user?.role !== "ADMIN" ? (
                      <p className="text-sm text-slate-400 text-center py-6">
                        Integrations are managed by your host.
                      </p>
                    ) : loadingProps ? (
                      <div className="flex justify-center py-6"><Spinner size="sm" /></div>
                    ) : properties.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-6">No properties yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {properties.map((prop) => (
                          <div key={prop.id} className="p-4 rounded-2xl border border-slate-100">
                            <p className="text-sm font-semibold text-slate-900 mb-2">{prop.name}</p>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                {prop.airbnbIcalUrl ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                )}
                                <span className={`text-xs font-medium ${prop.airbnbIcalUrl ? "text-emerald-700" : "text-slate-400"}`}>
                                  Airbnb — {prop.airbnbIcalUrl ? "Connected" : "Not connected"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {prop.vrboIcalUrl ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                )}
                                <span className={`text-xs font-medium ${prop.vrboIcalUrl ? "text-emerald-700" : "text-slate-400"}`}>
                                  VRBO — {prop.vrboIcalUrl ? "Connected" : "Not connected"}
                                </span>
                              </div>
                            </div>
                            <Link href={`/properties/${prop.id}`}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium mt-2">
                              Edit property <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* ── SECURITY ── */}
              {activeTab === "security" && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
                    <div className="space-y-4">
                      {pwError && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                          {pwError}
                        </div>
                      )}
                      {pwSaved && (
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
                          <Check className="w-4 h-4" /> Password updated successfully.
                        </div>
                      )}
                      <Input
                        label="Current password"
                        type="password"
                        placeholder="••••••••"
                        value={pwForm.current}
                        onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                      />
                      <Input
                        label="New password"
                        type="password"
                        placeholder="Min. 8 characters"
                        value={pwForm.newPw}
                        onChange={(e) => setPwForm({ ...pwForm, newPw: e.target.value })}
                      />
                      <Input
                        label="Confirm new password"
                        type="password"
                        placeholder="Re-enter new password"
                        value={pwForm.confirm}
                        onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                      />
                      <Button onClick={handleChangePassword} disabled={savingPw}>
                        {savingPw ? "Updating…" : "Update Password"}
                      </Button>
                    </div>
                  </Card>

                  <Card className="border-red-100">
                    <CardHeader><CardTitle className="text-red-600">Danger Zone</CardTitle></CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-700">Permanently delete your account and all data.</p>
                        <p className="text-xs text-red-400 mt-1">This action cannot be undone</p>
                      </div>
                      <Button variant="danger" size="sm" onClick={handleDeleteAccount}>
                        Delete Account
                      </Button>
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
