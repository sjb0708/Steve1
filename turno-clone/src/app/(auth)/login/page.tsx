"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react"
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

  const demoLogin = async (email: string) => {
    setForm({ email, password: "password123" })
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "password123" }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Login failed")
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setError("Network error.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background pattern */}
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
          <h1 className="text-2xl font-black text-white mb-2">Welcome back</h1>
          <p className="text-blue-300 text-sm">Sign in to manage your cleanings</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          {/* Demo accounts */}
          <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-3">Demo accounts (click to login instantly):</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => demoLogin("sarah@example.com")}
                className="text-left px-3 py-2 bg-white rounded-xl border border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-xs"
              >
                <span className="font-medium text-slate-900">Host:</span>{" "}
                <span className="text-slate-600">sarah@example.com</span>
                <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">Host</span>
              </button>
              <button
                onClick={() => demoLogin("maria@example.com")}
                className="text-left px-3 py-2 bg-white rounded-xl border border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-xs"
              >
                <span className="font-medium text-slate-900">Cleaner:</span>{" "}
                <span className="text-slate-600">maria@example.com</span>
                <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">Cleaner</span>
              </button>
            </div>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-slate-400">or sign in with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <Input
              label="Email address"
              type="email"
              icon={Mail}
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-300 transition-all"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-300" />
                Remember me
              </label>
              <a href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Forgot password?</a>
            </div>

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Sign in
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-blue-600 font-semibold hover:text-blue-700">
              Sign up free
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
