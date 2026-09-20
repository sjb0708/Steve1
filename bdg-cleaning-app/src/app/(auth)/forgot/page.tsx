"use client"
import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react"

export default function ForgotPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || "Something went wrong.")
      } else {
        setSent(true)
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&q=80')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/90 via-slate-900/85 to-slate-900/90" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-sm relative"
      >
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Bailey Development Group"
            className="w-24 h-24 object-contain bg-white rounded-3xl p-2 shadow-2xl mx-auto"
          />
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-3xl p-7 shadow-2xl">
          {sent ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h1 className="text-white font-bold text-lg">Check your email</h1>
              <p className="text-blue-100 text-sm">
                If that address is on file, we&apos;ve sent a link with your username and a way
                to set a new password. It works for one hour.
              </p>
              <p className="text-blue-300/70 text-xs">
                Don&apos;t see it? Check your Spam and Promotions folders for
                &quot;baileydevelopmentgroup&quot;.
              </p>
              <Link
                href="/login"
                className="inline-block w-full mt-2 py-3 px-6 bg-white text-blue-900 font-bold text-sm rounded-xl hover:bg-blue-50 transition-all"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-white font-bold text-lg text-center">Forgot your login?</h1>
              <p className="text-white/70 text-sm text-center mt-1 mb-6">
                Enter your email address and we&apos;ll send you your username and a link to
                set a new password.
              </p>

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
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-3 text-sm text-white bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 placeholder:text-blue-300/50 transition-all"
                    />
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
                    <>Send me a link <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-5 border-t border-white/10 text-center">
                <Link href="/login" className="text-sm text-blue-300 hover:text-white transition-colors">
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
