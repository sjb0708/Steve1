"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Mail, Lock, User, Phone, MapPin, ArrowRight, Building2, Briefcase, Check } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

type Role = "HOST" | "CLEANER"

export default function RegisterPage() {
  const router = useRouter()
  const [role, setRole] = useState<Role>("HOST")
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: "", email: "", password: "", phone: "", location: "",
    bio: "", hourlyRate: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 1) { setStep(2); return }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, role, hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Registration failed")
        setStep(1)
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-400/10 rounded-full blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
              <Sparkles className="w-5 h-5 text-blue-300" />
            </div>
            <span className="font-bold text-white text-lg">
              BDG <span className="text-blue-300">Cleaning</span>
            </span>
          </Link>
          <h1 className="text-2xl font-black text-white mb-2">Create your account</h1>
          <p className="text-blue-300 text-sm">Join 12,000+ hosts and cleaners</p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${s <= step ? "bg-blue-400" : "bg-white/20"}`} />
          ))}
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">I am a...</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { value: "HOST", label: "Property Host", desc: "I own rental properties", icon: Building2, color: "blue" },
                      { value: "CLEANER", label: "Cleaner", desc: "I provide cleaning services", icon: Briefcase, color: "emerald" },
                    ] as const).map((opt) => (
                      <button key={opt.value} type="button" onClick={() => setRole(opt.value)}
                        className={`relative p-4 rounded-2xl border-2 text-left transition-all ${role === opt.value
                          ? opt.color === "blue"
                            ? "border-blue-500 bg-blue-50"
                            : "border-emerald-500 bg-emerald-50"
                          : "border-slate-200 hover:border-slate-300"}`}>
                        {role === opt.value && (
                          <span className={`absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center ${opt.color === "blue" ? "bg-blue-500" : "bg-emerald-500"}`}>
                            <Check className="w-3 h-3 text-white" />
                          </span>
                        )}
                        <opt.icon className={`w-5 h-5 mb-2 ${role === opt.value ? (opt.color === "blue" ? "text-blue-600" : "text-emerald-600") : "text-slate-400"}`} />
                        <p className="font-semibold text-slate-900 text-sm">{opt.label}</p>
                        <p className="text-xs text-slate-500">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
                )}

                <Input label="Full name" type="text" icon={User} placeholder="Sarah Johnson"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                <Input label="Email address" type="email" icon={Mail} placeholder="you@example.com"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                <Input label="Password" type="password" icon={Lock} placeholder="Min. 8 characters"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required minLength={8} hint="Must be at least 8 characters" />

                <Button type="submit" className="w-full" size="lg">
                  Continue <ArrowRight className="w-4 h-4" />
                </Button>

                <p className="text-center text-sm text-slate-500">
                  Already have an account?{" "}
                  <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-700">Sign in</Link>
                </p>
              </motion.form>
            ) : (
              <motion.form key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }} onSubmit={handleSubmit} className="space-y-4">
                <div className="mb-2">
                  <p className="font-semibold text-slate-900">Almost done, {form.name.split(" ")[0]}!</p>
                  <p className="text-sm text-slate-500">Add a few more details to complete your profile.</p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
                )}

                <Input label="Phone number" type="tel" icon={Phone} placeholder="+1 (555) 000-0000"
                  value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <Input label="Location" type="text" icon={MapPin} placeholder="Miami, FL"
                  value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />

                {role === "CLEANER" && (
                  <Input label="Hourly rate ($)" type="number" placeholder="25.00"
                    value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                    hint="Your typical hourly cleaning rate" min="10" max="200" step="0.50" />
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Bio{" "}<span className="text-slate-400 font-normal">(optional)</span></label>
                  <textarea
                    placeholder={role === "HOST" ? "Tell cleaners about your properties..." : "Tell hosts about your experience..."}
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-300 transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" size="lg" className="flex-1"
                    onClick={() => setStep(1)}>Back</Button>
                  <Button type="submit" size="lg" className="flex-1" loading={loading}>
                    Create account
                  </Button>
                </div>

                <p className="text-center text-xs text-slate-400">
                  By creating an account, you agree to our{" "}
                  <a href="#" className="text-blue-600">Terms of Service</a> and{" "}
                  <a href="#" className="text-blue-600">Privacy Policy</a>
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
