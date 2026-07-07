"use client"
import { useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Mail, Lock, User, Phone, MapPin, ArrowRight, Check } from "lucide-react"
import { Button } from "@/components/ui/Button"

function RegisterForm() {
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get("invite")
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: "", email: "", password: "", phone: "", location: "", bio: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 1 && !inviteToken) { setStep(2); return }

    setLoading(true)
    setError("")
    try {
      if (inviteToken) {
        const res = await fetch("/api/invite/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: inviteToken, name: form.name, password: form.password }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || "Failed to accept invite")
        } else {
          router.push("/dashboard")
          router.refresh()
        }
        return
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Registration failed")
        setStep(1)
      } else {
        setSuccess(true)
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-3xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Registration Submitted!</h2>
        <p className="text-slate-500 text-sm mb-6">
          Your account is pending approval. You&apos;ll be notified once an admin approves your account.
        </p>
        <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-700 text-sm">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-3xl p-8 shadow-2xl">
      {!inviteToken && (
        <div className="flex items-center justify-center gap-3 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  step > s
                    ? "bg-blue-400 border-blue-400 text-white"
                    : step === s
                    ? "border-blue-400 text-blue-300"
                    : "border-white/20 text-white/30"
                }`}
              >
                {step > s ? <Check className="w-3.5 h-3.5" /> : s}
              </div>
              {s < 2 && <div className={`w-8 h-0.5 ${step > s ? "bg-blue-400" : "bg-white/20"}`} />}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-sm text-red-200">
            {error}
          </div>
        )}

        {(step === 1 || inviteToken) && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-blue-100">Full name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300" />
                <input type="text" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full pl-10 pr-4 py-3 text-sm text-white bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 placeholder:text-blue-300/50 transition-all" />
              </div>
            </div>
            {!inviteToken && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-blue-100">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300" />
                  <input type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
                    className="w-full pl-10 pr-4 py-3 text-sm text-white bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 placeholder:text-blue-300/50 transition-all" />
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-blue-100">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300" />
                <input type="password" placeholder="Min. 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required
                  className="w-full pl-10 pr-4 py-3 text-sm text-white bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 placeholder:text-blue-300/50 transition-all" />
              </div>
            </div>
          </>
        )}

        {step === 2 && !inviteToken && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-blue-100">Phone (optional)</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300" />
                <input type="tel" placeholder="(555) 000-0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 text-sm text-white bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 placeholder:text-blue-300/50 transition-all" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-blue-100">Location (optional)</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300" />
                <input type="text" placeholder="City, State" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 text-sm text-white bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 placeholder:text-blue-300/50 transition-all" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-blue-100">Bio (optional)</label>
              <textarea placeholder="A short intro about yourself..." value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3}
                className="w-full px-3 py-2.5 text-sm text-white bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 placeholder:text-blue-300/50 resize-none transition-all" />
            </div>
          </>
        )}

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {inviteToken ? "Set up account" : step === 1 ? "Continue" : "Create account"}
          <ArrowRight className="w-4 h-4" />
        </Button>

        {step === 2 && !inviteToken && (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="w-full text-sm text-blue-300 hover:text-white mt-1 transition-colors"
          >
            ← Back
          </button>
        )}
      </form>

      <p className="text-center text-sm text-blue-300 mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-white font-semibold hover:text-blue-200 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&q=80')" }} />
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/90 via-slate-900/85 to-slate-900/90" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-400/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        <div className="text-center mb-8">
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 rounded-3xl blur-xl scale-110" />
              <img src="/logo.png" alt="Bailey Development Group" className="relative w-36 h-36 object-contain bg-white rounded-3xl p-3 shadow-2xl" />
            </div>
            <div>
              <p className="font-bold text-white text-xl leading-tight">Bailey Development Group</p>
              <p className="text-blue-300 text-sm">Cleaning Management</p>
            </div>
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Create your account</h1>
          <p className="text-blue-300 text-sm">Register as a cleaner — approval required</p>
        </div>

        <Suspense fallback={<div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-3xl p-8 shadow-2xl h-64 animate-pulse" />}>
          <RegisterForm />
        </Suspense>
      </motion.div>
    </div>
  )
}
