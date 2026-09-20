"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    fetch("/api/auth/logout", { method: "POST" })
      .finally(() => {
        router.push("/login")
        router.refresh()
      })
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 flex items-center justify-center">
      <p className="text-white text-sm">Signing out...</p>
    </div>
  )
}
