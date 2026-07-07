"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: "", password: "" })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Login failed")
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background photo */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&q=80')" }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/90 via-slate-900/85 to-slate-900/90" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-sm relative"
      >
        {/* Logo & branding */}
        <div className="text-center mb-8">
          <div className="inline-flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 rounded-3xl blur-xl scale-110" />
              <img
                src="/logo.png"
                alt="Bailey Development Group"
                className="relative w-36 h-36 object-contain bg-white rounded-3xl p-3 shadow-2xl"
              />
            </div>
            <div>
              <h1 className="text-white font-black text-2xl leading-tight tracking-tight">Bailey Development Group</h1>
              <p className="text-blue-300 text-sm mt-1 font-medium tracking-wide uppercase">Cleaning Management</p>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-3xl p-7 shadow-2xl">
          <p className="text-white/70 text-sm text-center mb-6">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-blue-100">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 text-sm text-white bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 placeholder:text-blue-300/50 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-blue-100">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300" />
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-3 text-sm text-white bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 placeholder:text-blue-300/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-6 bg-white text-blue-900 font-bold text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-blue-50 active:scale-[0.98] transition-all shadow-lg disabled:opacity-60"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-blue-900/30 border-t-blue-900 rounded-full animate-spin" />
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-white/10 text-center">
            <p className="text-sm text-blue-300">
              New cleaner?{" "}
              <Link href="/register" className="text-white font-semibold hover:text-blue-200 transition-colors">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
