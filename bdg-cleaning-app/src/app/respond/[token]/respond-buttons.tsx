"use client"

import { useState } from "react"
import { Check, X, Loader2 } from "lucide-react"

export default function RespondButtons({ token }: { token: string }) {
  const [submitting, setSubmitting] = useState<"ACCEPT" | "DECLINE" | null>(null)
  const [result, setResult] = useState<"ACCEPTED" | "DECLINED" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function respond(action: "ACCEPT" | "DECLINE") {
    setSubmitting(action)
    setError(null)
    try {
      const res = await fetch(`/api/respond/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Something went wrong. Please try again.")
      }
      setResult(action === "ACCEPT" ? "ACCEPTED" : "DECLINED")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(null)
    }
  }

  if (result === "ACCEPTED") {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
          <Check className="w-6 h-6 text-emerald-600" />
        </div>
        <p className="font-semibold text-slate-900">You&apos;re confirmed!</p>
        <p className="text-sm text-slate-500 mt-1">
          The job is yours. You&apos;ll be contacted with any updates — see you there.
        </p>
      </div>
    )
  }

  if (result === "DECLINED") {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <X className="w-6 h-6 text-slate-500" />
        </div>
        <p className="font-semibold text-slate-900">No problem — you&apos;ve declined.</p>
        <p className="text-sm text-slate-500 mt-1">The job will be offered to someone else.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => respond("ACCEPT")}
          disabled={submitting !== null}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-colors"
        >
          {submitting === "ACCEPT" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          Accept
        </button>
        <button
          onClick={() => respond("DECLINE")}
          disabled={submitting !== null}
          className="flex items-center justify-center gap-2 bg-white hover:bg-red-50 disabled:opacity-60 text-red-600 font-semibold py-3.5 rounded-xl border border-red-200 transition-colors"
        >
          {submitting === "DECLINE" ? <Loader2 className="w-5 h-5 animate-spin" /> : <X className="w-5 h-5" />}
          Decline
        </button>
      </div>
      {error && <p className="text-sm text-red-600 text-center mt-3">{error}</p>}
    </div>
  )
}
