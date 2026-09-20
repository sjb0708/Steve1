"use client"
import { useState, useEffect, useRef } from "react"
import { Header } from "@/components/layout/Header"
import { Card, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { CARRIER_OPTIONS } from "@/lib/carriers"
import { Avatar } from "@/components/ui/Avatar"
import { Textarea } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { useAuth } from "@/components/layout/Providers"
import { User, Bell, Shield, Link2, Camera, Check, ExternalLink, CheckCircle2, AlertCircle, Sparkles, KeyRound } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "ai", label: "AI Assistant", icon: Sparkles, adminOnly: true },
  { id: "security", label: "Security", icon: Shield },
]

type Property = {
  id: string
  name: string
  airbnbIcalUrl?: string | null
  vrboIcalUrl?: string | null
}

export default function SettingsPage() {
  const { user, refetch } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState("profile")

  // Profile state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [avatarError, setAvatarError] = useState("")
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [form, setForm] = useState({ name: "", email: "", phone: "", location: "", bio: "" })

  // Notification prefs state
  const [emailNotif, setEmailNotif] = useState(true)
  const [smsNotif, setSmsNotif] = useState(true)
  const [appNotif, setAppNotif] = useState(true)
  const [notifPhone, setNotifPhone] = useState("")
  const [notifCarrier, setNotifCarrier] = useState("")
  const [savingNotif, setSavingNotif] = useState(false)
  const [savedNotif, setSavedNotif] = useState(false)
  const [notifError, setNotifError] = useState("")

  // App-wide switch: hold back every cleaner-facing email and text
  const [cleanerPaused, setCleanerPaused] = useState<boolean | null>(null)
  const [savingPause, setSavingPause] = useState(false)

  // Claude API key for the Risk Assessment page. The server only ever sends
  // back whether a key is set and its last 4 characters.
  const [aiKey, setAiKey] = useState<{ set: boolean; last4: string | null; source: "settings" | "env" | null } | null>(null)
  const [aiKeyInput, setAiKeyInput] = useState("")
  const [savingAiKey, setSavingAiKey] = useState(false)
  const [aiKeyMsg, setAiKeyMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (user?.role !== "ADMIN") return
    fetch("/api/settings/app")
      .then((r) => r.json())
      .then((d) => {
        setCleanerPaused(!!d.cleanerNotificationsPaused)
        if (d.anthropicKey) setAiKey(d.anthropicKey)
      })
      .catch(() => {})
  }, [user])

  // Links like /settings?tab=ai open straight to that tab
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab")
    if (tab && TABS.some((t) => t.id === tab)) setActiveTab(tab)
  }, [])

  async function saveAiKey(value: string) {
    setSavingAiKey(true)
    setAiKeyMsg(null)
    try {
      const res = await fetch("/api/settings/app", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicApiKey: value }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAiKeyMsg({ ok: false, text: d.error ?? "Couldn't save the key." })
        return
      }
      setAiKey(d.anthropicKey)
      setAiKeyInput("")
      setAiKeyMsg({ ok: true, text: value ? "Key checked with Anthropic and saved." : "Key removed." })
    } catch {
      setAiKeyMsg({ ok: false, text: "Couldn't save the key. Please try again." })
    } finally {
      setSavingAiKey(false)
    }
  }

  async function toggleCleanerPause() {
    const next = !cleanerPaused
    setSavingPause(true)
    try {
      const res = await fetch("/api/settings/app", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleanerNotificationsPaused: next }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) setCleanerPaused(!!d.cleanerNotificationsPaused)
    } catch {
      // leave the toggle where it was
    } finally {
      setSavingPause(false)
    }
  }

  // Test alert
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ emailSent: boolean; smsSent: boolean; skipped: string[] } | null>(null)
  const [testError, setTestError] = useState("")

  async function handleSendTest() {
    setTesting(true)
    setTestError("")
    setTestResult(null)
    try {
      const res = await fetch("/api/notifications/test", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setTestError(data.error ?? "Couldn't send the test.")
      else setTestResult(data)
    } catch {
      setTestError("Couldn't send the test. Please try again.")
    } finally {
      setTesting(false)
    }
  }

  // Password state
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" })
  const [pwError, setPwError] = useState("")
  const [pwSaved, setPwSaved] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  // Integrations
  const [properties, setProperties] = useState<Property[]>([])
  const [loadingProps, setLoadingProps] = useState(false)

  // Account deletion
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  async function handleDeleteAccount() {
    setDeleteError("")
    setDeleting(true)
    try {
      const res = await fetch("/api/auth/me", { method: "DELETE" })
      if (res.ok) {
        window.location.href = "/login"
        return
      }
      const d = await res.json().catch(() => ({}))
      setDeleteError(d.error ?? "Failed to delete account.")
    } catch {
      setDeleteError("Something went wrong.")
    } finally {
      setDeleting(false)
    }
  }

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
      setSmsNotif((user as { smsNotifications?: boolean }).smsNotifications ?? true)
      setAppNotif((user as { appNotifications?: boolean }).appNotifications ?? true)
      setNotifPhone((user as { phone?: string }).phone ?? "")
      setNotifCarrier((user as { carrier?: string }).carrier ?? "")
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
    setAvatarError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload/avatar", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAvatarError(data.error ?? "Failed to upload photo.")
      } else if (data.avatarUrl) {
        setAvatarUrl(data.avatarUrl)
        await refetch()
      }
    } catch {
      setAvatarError("Failed to upload photo. Please try again.")
    }
    setUploading(false)
  }

  const handleSaveProfile = async () => {
    if (!user) return
    setSaving(true)
    setSaveError("")
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, phone: form.phone, location: form.location, bio: form.bio }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSaveError(data.error ?? "Failed to save changes.")
      } else {
        await refetch()
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch {
      setSaveError("Failed to save changes. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNotifications = async () => {
    if (!user) return
    setSavingNotif(true)
    setNotifError("")
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailNotifications: emailNotif,
          smsNotifications: smsNotif,
          appNotifications: appNotif,
          phone: notifPhone,
          carrier: notifCarrier,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setNotifError(data.error ?? "Failed to save preferences.")
      } else {
        await refetch()
        setTestResult(null)
        setSavedNotif(true)
        setTimeout(() => setSavedNotif(false), 2500)
      }
    } catch {
      setNotifError("Failed to save preferences. Please try again.")
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
              {TABS.filter((tab) => !tab.adminOnly || user?.role === "ADMIN").map((tab) => (
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
                <div className="space-y-5">
                  <Card>
                    <CardHeader><CardTitle>How You Get Alerts</CardTitle></CardHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600">
                        Turn on the ways you want to be reached. Every admin on the account gets
                        the same alerts, each on their own channels.
                      </p>

                      <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Email</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {form.email ? `Sent to ${form.email}` : "No email address on your account"}
                          </p>
                        </div>
                        <button
                          onClick={() => setEmailNotif(!emailNotif)}
                          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${emailNotif ? "bg-blue-600" : "bg-slate-200"}`}
                        >
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${emailNotif ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </label>

                      <div className="p-4 rounded-2xl border border-slate-100">
                        <label className="flex items-center justify-between cursor-pointer">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Text message</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Free — sent through your carrier, no extra cost
                            </p>
                          </div>
                          <button
                            onClick={() => setSmsNotif(!smsNotif)}
                            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${smsNotif ? "bg-blue-600" : "bg-slate-200"}`}
                          >
                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${smsNotif ? "translate-x-6" : "translate-x-1"}`} />
                          </button>
                        </label>

                        {smsNotif && (
                          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                            <Input
                              label="Mobile number"
                              placeholder="352-555-0100"
                              value={notifPhone}
                              onChange={(e) => setNotifPhone(e.target.value)}
                            />
                            <Select
                              label="Mobile carrier"
                              options={CARRIER_OPTIONS}
                              value={notifCarrier}
                              onChange={(e) => setNotifCarrier(e.target.value)}
                              hint="Texts can't be sent until a carrier is picked."
                            />
                            {(!notifPhone || !notifCarrier) && (
                              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                Add both a mobile number and a carrier, then save — otherwise no
                                texts will go out.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">In the app</p>
                          <p className="text-xs text-slate-500 mt-0.5">The bell icon at the top of the screen</p>
                        </div>
                        <button
                          onClick={() => setAppNotif(!appNotif)}
                          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${appNotif ? "bg-blue-600" : "bg-slate-200"}`}
                        >
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${appNotif ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </label>

                      {notifError && (
                        <p className="text-sm text-red-600 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" /> {notifError}
                        </p>
                      )}

                      <Button onClick={handleSaveNotifications} disabled={savingNotif} className="gap-2">
                        {savedNotif ? <><Check className="w-4 h-4" /> Saved!</> : savingNotif ? "Saving…" : "Save Preferences"}
                      </Button>
                    </div>
                  </Card>

                  {user?.role === "ADMIN" && (
                    <Card className={cleanerPaused ? "border-amber-200" : undefined}>
                      <CardHeader><CardTitle>Cleaner Notifications</CardTitle></CardHeader>
                      <div className="space-y-4">
                        <label className="flex items-center justify-between gap-4 cursor-pointer">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              Pause all emails and texts to cleaners
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Use while you&apos;re still setting up the schedule. Your own alerts
                              are not affected.
                            </p>
                          </div>
                          <button
                            onClick={toggleCleanerPause}
                            disabled={savingPause || cleanerPaused === null}
                            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${cleanerPaused ? "bg-amber-500" : "bg-slate-200"}`}
                          >
                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${cleanerPaused ? "translate-x-6" : "translate-x-1"}`} />
                          </button>
                        </label>

                        {cleanerPaused && (
                          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 space-y-2">
                            <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                              <AlertCircle className="w-4 h-4" /> Cleaners are not being contacted
                            </p>
                            <p className="text-sm text-amber-800">
                              Job offers, reminders, and confirmations are all held back. A cleaner
                              you assign won&apos;t get the accept-or-decline link, so the job will
                              sit at &quot;Awaiting Confirmation&quot; until you turn this off or
                              they log in themselves.
                            </p>
                            <p className="text-sm text-amber-800">
                              Everything is still recorded in the app — nothing is lost, it just
                              isn&apos;t sent.
                            </p>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                  <Card>
                    <CardHeader><CardTitle>Send Yourself a Test</CardTitle></CardHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600">
                        Sends a sample alert right now so you can check it actually arrives.
                        Save your preferences first.
                      </p>

                      <Button variant="outline" onClick={handleSendTest} disabled={testing}>
                        {testing ? "Sending…" : "Send Test Alert"}
                      </Button>

                      {testError && (
                        <p className="text-sm text-red-600 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" /> {testError}
                        </p>
                      )}

                      {testResult && (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                          <p className="text-sm text-slate-900 flex items-center gap-2">
                            {testResult.emailSent
                              ? <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Email sent — check your inbox.</>
                              : <><AlertCircle className="w-4 h-4 text-slate-400" /> No email sent.</>}
                          </p>
                          <p className="text-sm text-slate-900 flex items-center gap-2">
                            {testResult.smsSent
                              ? <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Text sent — check your phone.</>
                              : <><AlertCircle className="w-4 h-4 text-slate-400" /> No text sent.</>}
                          </p>
                          {testResult.skipped.length > 0 && (
                            <ul className="pt-1 space-y-1">
                              {testResult.skipped.map((s) => (
                                <li key={s} className="text-xs text-slate-500">— {s}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>

                  {user?.role === "ADMIN" && (
                    <Card>
                      <CardHeader><CardTitle>What You&apos;ll Be Alerted About</CardTitle></CardHeader>
                      <ul className="space-y-2.5">
                        {[
                          "Every evening at 6 PM: what's scheduled for tomorrow — property, address, checkout time, and who's on it",
                          "In the morning, only if something's wrong — a cleaning today with nobody assigned",
                          "A new cleaning is needed — a booking synced and nobody is assigned yet",
                          "A cleaning is coming up in 3 days and still has no cleaner",
                          "A cleaner accepts or declines a job",
                          "A cleaner finishes a job and payment is due",
                          "A cleaner requests supplies, or supplies stay unordered for 24 hours",
                          "A cleaner reports damage or an issue at a property",
                        ].map((line) => (
                          <li key={line} className="text-sm text-slate-700 flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            {line}
                          </li>
                        ))}
                      </ul>

                      <div className="mt-5 pt-5 border-t border-slate-100">
                        <p className="text-sm font-semibold text-slate-900 mb-2">How far ahead</p>
                        <p className="text-sm text-slate-600">
                          Emails and texts only cover cleanings in the <b>current month</b>, so a
                          booking made now for months out won&apos;t wake your phone.
                          <b> Two weeks before the month ends</b>, you get one summary of next
                          month&apos;s cleanings that still need a cleaner — enough runway to line
                          people up — and from then on that month is covered normally. Anything
                          further out is still recorded under the bell icon.
                        </p>
                      </div>
                    </Card>
                  )}
                </div>
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

              {/* ── AI ASSISTANT ── */}
              {activeTab === "ai" && user?.role === "ADMIN" && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle>Claude API Key</CardTitle></CardHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600">
                        Powers the <Link href="/risk-assessment" className="text-blue-600 hover:underline font-medium">Risk Assessment</Link> page.
                        Usage is billed to your Anthropic account, usually under $2 per assessment.
                      </p>

                      <div className={`p-4 rounded-2xl border flex items-center gap-3 ${aiKey?.set ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100"}`}>
                        {aiKey?.set
                          ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                          : <KeyRound className="w-5 h-5 text-slate-400 flex-shrink-0" />}
                        <div className="text-sm">
                          {aiKey === null ? (
                            <p className="text-slate-500">Checking…</p>
                          ) : aiKey.set ? (
                            <>
                              <p className="font-semibold text-emerald-900">Connected</p>
                              <p className="text-emerald-800">
                                Key ending in <span className="font-mono">{aiKey.last4}</span>
                                {aiKey.source === "env" && " (set as a server environment variable)"}
                              </p>
                            </>
                          ) : (
                            <p className="font-semibold text-slate-700">No key added yet</p>
                          )}
                        </div>
                      </div>

                      <Input
                        label={aiKey?.set ? "Replace key" : "Paste your key"}
                        type="password"
                        autoComplete="off"
                        placeholder="sk-ant-…"
                        value={aiKeyInput}
                        onChange={(e) => setAiKeyInput(e.target.value)}
                      />

                      {aiKeyMsg && (
                        <p className={`text-sm flex items-center gap-1.5 ${aiKeyMsg.ok ? "text-emerald-700" : "text-red-600"}`}>
                          {aiKeyMsg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                          {aiKeyMsg.text}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => saveAiKey(aiKeyInput)} disabled={savingAiKey || !aiKeyInput.trim()}>
                          {savingAiKey ? "Checking…" : "Save Key"}
                        </Button>
                        {aiKey?.set && aiKey.source === "settings" && (
                          <Button variant="outline" onClick={() => saveAiKey("")} disabled={savingAiKey}
                            className="text-red-600 border-red-200 hover:bg-red-50">
                            Remove Key
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>Getting a Key</CardTitle></CardHeader>
                    <ol className="space-y-2.5 text-sm text-slate-700 list-decimal pl-5">
                      <li>
                        Go to{" "}
                        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer"
                          className="text-blue-600 hover:underline font-medium">console.anthropic.com</a>{" "}
                        and sign in or create an account.
                      </li>
                      <li>Add a payment method or credits under Billing.</li>
                      <li>Open API Keys, click Create Key, and copy it. It&apos;s only shown once.</li>
                      <li>Paste it above and click Save Key.</li>
                    </ol>
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
                    <CardHeader><CardTitle className="text-red-600">Delete Account</CardTitle></CardHeader>
                    <div className="space-y-3">
                      <p className="text-sm text-slate-700">
                        Permanently deletes your account and personal information (name, email, phone,
                        photo). Any open jobs assigned to you are released back to the schedule.
                        Payment records are kept for bookkeeping but are no longer tied to your
                        personal details. This can&apos;t be undone.
                      </p>
                      <Input
                        label='Type DELETE to confirm'
                        placeholder="DELETE"
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                      />
                      {deleteError && (
                        <p className="text-sm text-red-600 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" /> {deleteError}
                        </p>
                      )}
                      <Button
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        disabled={deleteConfirm !== "DELETE" || deleting}
                        onClick={handleDeleteAccount}
                      >
                        {deleting ? <Spinner size="sm" /> : "Delete My Account"}
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
