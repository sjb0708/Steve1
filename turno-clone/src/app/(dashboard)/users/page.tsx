"use client"
import { useEffect, useState } from "react"
import { useAuth } from "@/components/layout/Providers"
import { Header } from "@/components/layout/Header"
import { Card, CardHeader, CardTitle } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Button } from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { formatDate } from "@/lib/utils"
import type { User } from "@/types"
import {
  UserCheck, UserX, Users, Mail, Phone, MapPin,
  Plus, Copy, CheckCircle2, AlertCircle, Shield, Pencil, KeyRound,
} from "lucide-react"
import { motion } from "framer-motion"

const stagger = { visible: { transition: { staggerChildren: 0.07 } } }
const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }

// ─── Invite Admin Modal ───────────────────────────────────────────────────────

interface InviteModalProps {
  open: boolean
  onClose: () => void
}

function InviteAdminModal({ open, onClose }: InviteModalProps) {
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")

  function reset() {
    setEmail("")
    setInviteUrl(null)
    setCopied(false)
    setError("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.error ?? "Failed to create invite.")
        return
      }
      setInviteUrl(d.inviteUrl ?? d.url ?? d.link ?? JSON.stringify(d))
    } catch {
      setError("Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  async function copyUrl() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title="Invite Admin"
      description="Send an invite link for a new admin account"
    >
      <div className="p-6 space-y-4">
        {!inviteUrl ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={Mail}
              required
            />
            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> {error}
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { reset(); onClose() }}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? <Spinner size="sm" /> : "Generate Invite"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-medium text-emerald-800">Invite link created!</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Share this link:</p>
              <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs text-slate-700 flex-1 break-all font-mono">{inviteUrl}</p>
                <button
                  onClick={copyUrl}
                  className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors flex-shrink-0"
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-500" />
                  )}
                </button>
              </div>
            </div>
            <Button className="w-full" variant="outline" onClick={() => { reset(); onClose() }}>
              Done
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Add Cleaner Modal ────────────────────────────────────────────────────────

interface AddCleanerModalProps {
  open: boolean
  onClose: () => void
  onAdded: (user: User) => void
}

function AddCleanerModal({ open, onClose, onAdded }: AddCleanerModalProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  function reset() {
    setName("")
    setEmail("")
    setPhone("")
    setError("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.error ?? "Failed to add cleaner.")
        return
      }
      onAdded(d.user)
      reset()
      onClose()
    } catch {
      setError("Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title="Add Cleaner"
      description="They don't need to log in — job offers arrive by email with one-tap accept/decline"
    >
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="Maria Garcia"
            value={name}
            onChange={(e) => setName(e.target.value)}
            icon={Users}
            required
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="cleaner@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={Mail}
            required
          />
          <Input
            label="Phone (optional)"
            type="tel"
            placeholder="(352) 555-0100"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            icon={Phone}
          />
          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => { reset(); onClose() }}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : "Add Cleaner"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

// ─── Edit Cleaner Modal ───────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: "", label: "Not set" },
  { value: "Zelle", label: "Zelle" },
  { value: "PayPal", label: "PayPal" },
  { value: "Venmo", label: "Venmo" },
  { value: "Bank Transfer", label: "Bank Transfer" },
  { value: "Cash", label: "Cash" },
  { value: "Other", label: "Other" },
]

const NOTIFICATION_CHANNELS = [
  { value: "EMAIL", label: "Email only" },
  { value: "TEXT", label: "Text only" },
  { value: "BOTH", label: "Email + Text" },
]

interface EditCleanerModalProps {
  user: User | null
  onClose: () => void
  onSaved: (user: User) => void
}

function EditCleanerModal({ user, onClose, onSaved }: EditCleanerModalProps) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", notificationChannel: "EMAIL", paymentMethod: "", paymentDetails: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        notificationChannel: user.notificationChannel || "EMAIL",
        paymentMethod: user.paymentMethod || "",
        paymentDetails: user.paymentDetails || "",
      })
      setError("")
    }
  }, [user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError("")
    setSubmitting(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.error ?? "Failed to save changes.")
        return
      }
      onSaved(d.user)
      onClose()
    } catch {
      setError("Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  const paymentLabel =
    form.paymentMethod === "Zelle" ? "Zelle phone or email"
    : form.paymentMethod === "PayPal" ? "PayPal email or @handle"
    : form.paymentMethod === "Venmo" ? "Venmo @handle"
    : form.paymentMethod === "Bank Transfer" ? "Account / routing info"
    : form.paymentMethod === "Other" ? "Details"
    : null

  return (
    <Modal open={!!user} onClose={onClose} title="Edit Cleaner" description={user?.name}>
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Full Name" value={form.name} icon={Users}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input label="Email Address" type="email" value={form.email} icon={Mail}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          <Input label="Phone" type="tel" value={form.phone} icon={Phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <Select label="Notification Preference"
            value={form.notificationChannel}
            onChange={(e) => setForm((f) => ({ ...f, notificationChannel: e.target.value }))}
            options={NOTIFICATION_CHANNELS} />
          <p className="text-xs text-slate-400 -mt-2">Text isn&apos;t live yet — this is saved and ready for when it is.</p>
          <Select label="Payment Method"
            value={form.paymentMethod}
            onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
            options={PAYMENT_METHODS} />
          {paymentLabel && (
            <Input label={paymentLabel} value={form.paymentDetails}
              onChange={(e) => setForm((f) => ({ ...f, paymentDetails: e.target.value }))} />
          )}
          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

// ─── Send Login Invite Modal ──────────────────────────────────────────────────

interface SendInviteModalProps {
  user: User | null
  onClose: () => void
}

function SendInviteModal({ user, onClose }: SendInviteModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (user) {
      setInviteUrl(null)
      setCopied(false)
      setError("")
    }
  }, [user])

  async function send() {
    if (!user) return
    setError("")
    setSubmitting(true)
    try {
      const res = await fetch(`/api/users/${user.id}/invite`, { method: "POST" })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.error ?? "Failed to send invite.")
        return
      }
      setInviteUrl(d.inviteUrl)
    } catch {
      setError("Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  async function copyUrl() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal open={!!user} onClose={onClose} title="Send Login Invite" description={`Let ${user?.name} set a password and log in`}>
      <div className="p-6 space-y-4">
        {!inviteUrl ? (
          <>
            <p className="text-sm text-slate-600">
              This is separate from job-assignment emails — it lets {user?.name} log into the app directly to see their schedule any time, not just when assigned a specific job. An email will be sent to {user?.email} with a link to set their password.
            </p>
            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> {error}
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1" onClick={send} disabled={submitting}>
                {submitting ? <Spinner size="sm" /> : "Send Invite"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-medium text-emerald-800">Invite sent (or logged, if email isn&apos;t configured yet).</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Link (in case email doesn&apos;t arrive):</p>
              <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs text-slate-700 flex-1 break-all font-mono">{inviteUrl}</p>
                <button onClick={copyUrl} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors flex-shrink-0">
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                </button>
              </div>
            </div>
            <Button className="w-full" variant="outline" onClick={onClose}>Done</Button>
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── User card ────────────────────────────────────────────────────────────────

interface UserCardProps {
  user: User
  pending?: boolean
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onDeactivate?: (id: string) => void
  onEdit?: (user: User) => void
  onSendInvite?: (user: User) => void
  actionLoading?: string | null
}

function UserCard({ user, pending, onApprove, onReject, onDeactivate, onEdit, onSendInvite, actionLoading }: UserCardProps) {
  const loading = actionLoading === user.id

  return (
    <motion.div variants={fadeUp} whileHover={{ y: -1 }} transition={{ duration: 0.15 }}>
      <Card padding="none" className="hover:border-blue-200 hover:shadow-md transition-all duration-200">
        <div className="p-4 flex items-start gap-4">
          <Avatar name={user.name} size="lg" className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="font-semibold text-slate-900">{user.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    user.role === "ADMIN"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {user.role === "ADMIN" ? "Admin" : "Cleaner"}
                  </span>
                  {!user.approved && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">
                      Pending
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-400">{formatDate(user.createdAt)}</p>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {user.email}
              </div>
              {user.phone && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {user.phone}
                </div>
              )}
              {user.location && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {user.location}
                </div>
              )}
              {user.bio && (
                <p className="text-xs text-slate-500 mt-2 leading-relaxed line-clamp-2">{user.bio}</p>
              )}
              {user.role === "CLEANER" && !pending && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 mt-1 border-t border-slate-50 text-xs text-slate-500">
                  <span>
                    Notify: <span className="font-medium text-slate-700">
                      {user.notificationChannel === "TEXT" ? "Text only" : user.notificationChannel === "BOTH" ? "Email + Text" : "Email only"}
                    </span>
                  </span>
                  <span>
                    Pay via: <span className="font-medium text-slate-700">
                      {user.paymentMethod ? `${user.paymentMethod}${user.paymentDetails ? ` (${user.paymentDetails})` : ""}` : "Not set"}
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            {(pending || onDeactivate || onEdit) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {pending && onApprove && (
                  <Button
                    size="sm"
                    onClick={() => onApprove(user.id)}
                    disabled={loading}
                  >
                    {loading ? <Spinner size="sm" /> : <UserCheck className="w-3.5 h-3.5" />}
                    Approve
                  </Button>
                )}
                {pending && onReject && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => onReject(user.id)}
                    disabled={loading}
                  >
                    {loading ? <Spinner size="sm" /> : <UserX className="w-3.5 h-3.5" />}
                    Reject
                  </Button>
                )}
                {!pending && user.role === "CLEANER" && onEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(user)}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                )}
                {!pending && user.role === "CLEANER" && onSendInvite && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSendInvite(user)}
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Send Login Invite
                  </Button>
                )}
                {!pending && onDeactivate && user.role === "CLEANER" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-slate-500"
                    onClick={() => onDeactivate(user.id)}
                    disabled={loading}
                  >
                    {loading ? <Spinner size="sm" /> : null}
                    Deactivate
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "ADMIN"

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [showAddCleaner, setShowAddCleaner] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [invitingUser, setInvitingUser] = useState<User | null>(null)

  async function loadUsers() {
    try {
      const res = await fetch("/api/users")
      if (res.ok) {
        const d = await res.json()
        setUsers(d.users ?? d)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  async function handleApprove(id: string) {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: true }),
      })
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === id ? { ...u, approved: true } : u))
      }
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(id: string) {
    if (!confirm("Remove this cleaner?")) return
    setActionLoading(id)
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" })
      if (res.ok) setUsers((prev) => prev.filter((u) => u.id !== id))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this cleaner? They will no longer be able to log in.")) return
    setActionLoading(id)
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: false }),
      })
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === id ? { ...u, approved: false } : u))
      }
    } finally {
      setActionLoading(null)
    }
  }

  const pending = users.filter((u) => u.role === "CLEANER" && !u.approved)
  const team = users.filter((u) => u.approved || u.role === "ADMIN")

  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <Header title="Team" subtitle="Admin access only" />
        <div className="flex items-center justify-center min-h-[400px] text-slate-500">
          <p>You don't have permission to view this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header
        title="Team"
        subtitle={`${team.length} member${team.length !== 1 ? "s" : ""}${pending.length ? ` · ${pending.length} pending` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowAddCleaner(true)}>
              <Plus className="w-4 h-4" /> Add Cleaner
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowInvite(true)}>
              <Shield className="w-4 h-4" /> Invite Admin
            </Button>
          </div>
        }
      />

      <div className="p-6 max-w-3xl space-y-8">
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {/* Pending approval */}
            {pending.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-amber-400 rounded-full" />
                  <h2 className="text-base font-bold text-slate-900">
                    Pending Approval
                    <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">
                      {pending.length}
                    </span>
                  </h2>
                </div>
                <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-3">
                  {pending.map((u) => (
                    <UserCard
                      key={u.id}
                      user={u}
                      pending
                      onApprove={handleApprove}
                      onReject={handleReject}
                      actionLoading={actionLoading}
                    />
                  ))}
                </motion.div>
              </section>
            )}

            {/* Team members */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-slate-400" />
                <h2 className="text-base font-bold text-slate-900">Team Members</h2>
              </div>

              {team.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                  <p className="font-medium">No team members yet</p>
                  <p className="text-sm mt-1">Approve cleaners above or invite an admin.</p>
                </div>
              ) : (
                <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-3">
                  {team.map((u) => (
                    <UserCard
                      key={u.id}
                      user={u}
                      onDeactivate={handleDeactivate}
                      onEdit={setEditingUser}
                      onSendInvite={setInvitingUser}
                      actionLoading={actionLoading}
                    />
                  ))}
                </motion.div>
              )}
            </section>
          </>
        )}
      </div>

      <InviteAdminModal open={showInvite} onClose={() => setShowInvite(false)} />
      <AddCleanerModal
        open={showAddCleaner}
        onClose={() => setShowAddCleaner(false)}
        onAdded={(u) => setUsers((prev) => [u, ...prev])}
      />
      <EditCleanerModal
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSaved={(u) => setUsers((prev) => prev.map((p) => p.id === u.id ? { ...p, ...u } : p))}
      />
      <SendInviteModal user={invitingUser} onClose={() => setInvitingUser(null)} />
    </div>
  )
}
