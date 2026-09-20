"use client"
import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Lock, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react"

// Replaces the old public sign-up page. Reached only by a link we sent —
// either an admin invite (?invite=) or a password reset (?forgot=).
function SetPasswordInner() {
  const router = useRouter()
  const params = useSearchParams()
  const resetToken = params.get("reset")
  const inviteToken = params.get("invite")
  const token = resetToken ?? inviteToken
  const kind = resetToken ? "reset" : "invite"

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("The two passwords don't match.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, kind, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Couldn't set your password.")
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
          {!token ? (
            <div className="text-center space-y-4">
              <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
              <h1 className="text-white font-bold text-lg">This link isn&apos;t valid</h1>
              <p className="text-blue-100 text-sm">
                Password links come by email and expire. Ask for a new one, or contact
                Bailey Development Group.
              </p>
              <Link
                href="/forgot"
                className="inline-block w-full mt-2 py-3 px-6 bg-white text-blue-900 font-bold text-sm rounded-xl hover:bg-blue-50 transition-all"
              >
                Send me a new link
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-white font-bold text-lg text-center">
                {kind === "reset" ? "Set a new password" : "Set your password"}
              </h1>
              <p className="text-white/70 text-sm text-center mt-1 mb-6">
                {kind === "reset"
                  ? "Pick a new password and you'll be signed straight in."
                  : "Choose a password to finish setting up your login."}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-sm text-red-200">
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-blue-100">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300" />
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
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

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-blue-100">Type it again</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300" />
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="Same password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
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
                    <>Save and sign in <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordInner />
    </Suspense>
  )
}
