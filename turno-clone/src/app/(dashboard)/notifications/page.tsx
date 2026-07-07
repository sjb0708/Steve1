"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import { formatDateTime } from "@/lib/utils"
import type { Notification } from "@/types"
import {
  Bell, BriefcaseBusiness, CalendarCheck, CalendarX,
  Info, CheckCheck, Clock,
} from "lucide-react"
import { motion } from "framer-motion"
import { formatDistanceToNow } from "date-fns"

const stagger = { visible: { transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }

function typeIcon(type: Notification["type"]) {
  switch (type) {
    case "JOB_ASSIGNED":
      return { Icon: BriefcaseBusiness, bg: "bg-blue-50", color: "text-blue-600" }
    case "JOB_UPDATED":
      return { Icon: CalendarCheck, bg: "bg-purple-50", color: "text-purple-600" }
    case "JOB_CANCELLED":
      return { Icon: CalendarX, bg: "bg-red-50", color: "text-red-500" }
    case "JOB_REMINDER":
      return { Icon: Clock, bg: "bg-amber-50", color: "text-amber-600" }
    default:
      return { Icon: Info, bg: "bg-slate-50", color: "text-slate-500" }
  }
}

function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification
  onClick: (n: Notification) => void
}) {
  const { Icon, bg, color } = typeIcon(notification.type)

  return (
    <motion.div variants={fadeUp}>
      <button
        onClick={() => onClick(notification)}
        className={`w-full flex items-start gap-4 p-4 text-left rounded-2xl transition-colors border ${
          notification.read
            ? "bg-white border-slate-100 hover:bg-slate-50"
            : "bg-blue-50/50 border-blue-100 hover:bg-blue-50"
        }`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-semibold ${notification.read ? "text-slate-700" : "text-slate-900"}`}>
              {notification.title}
            </p>
            {!notification.read && (
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
            )}
          </div>
          <p className={`text-sm mt-0.5 leading-relaxed ${notification.read ? "text-slate-500" : "text-slate-700"}`}>
            {notification.message}
          </p>
          <p className="text-xs text-slate-400 mt-1.5">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </p>
        </div>
      </button>
    </motion.div>
  )
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  async function loadNotifications() {
    try {
      const res = await fetch("/api/notifications")
      if (res.ok) {
        const d = await res.json()
        setNotifications(d.notifications ?? d)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadNotifications() }, [])

  async function handleClick(notification: Notification) {
    // Mark as read
    if (!notification.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      )
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id }),
      }).catch(() => {})
    }

    // Navigate based on type
    const title = notification.title.toLowerCase()
    if (notification.jobId) {
      router.push(`/jobs/${notification.jobId}`)
    } else if (title.includes("supply") || title.includes("supplies")) {
      router.push("/supply-requests")
    } else if (title.includes("issue")) {
      router.push("/issues")
    } else if (
      ["JOB_ASSIGNED", "JOB_UPDATED", "JOB_CANCELLED", "JOB_REMINDER"].includes(notification.type) ||
      title.includes("job") ||
      title.includes("cleaner") ||
      title.includes("assign")
    ) {
      router.push("/jobs")
    }
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read)
    if (unread.length === 0) return
    setMarkingAll(true)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await Promise.all(
        unread.map((n) =>
          fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: n.id }),
          })
        )
      )
    } catch {
      // best-effort
    } finally {
      setMarkingAll(false)
    }
  }

  const unread = notifications.filter((n) => !n.read)
  const read = notifications.filter((n) => n.read)

  return (
    <div className="min-h-screen">
      <Header
        title="Notifications"
        subtitle={unread.length > 0 ? `${unread.length} unread` : "All caught up"}
        actions={
          unread.length > 0 ? (
            <Button size="sm" variant="outline" onClick={markAllRead} disabled={markingAll}>
              {markingAll ? <Spinner size="sm" /> : <CheckCheck className="w-4 h-4" />}
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <div className="p-4 sm:p-6 max-w-2xl space-y-6">
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Spinner size="lg" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Bell className="w-14 h-14 mx-auto mb-4 text-slate-200" />
            <p className="font-semibold text-lg">No notifications yet</p>
            <p className="text-sm mt-1">You're all caught up. Check back later.</p>
          </div>
        ) : (
          <>
            {/* Unread */}
            {unread.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Unread
                    <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
                      {unread.length}
                    </span>
                  </h2>
                </div>
                <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-2">
                  {unread.map((n) => (
                    <NotificationItem key={n.id} notification={n} onClick={handleClick} />
                  ))}
                </motion.div>
              </section>
            )}

            {/* Read */}
            {read.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-bold text-slate-500">Earlier</h2>
                </div>
                <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-2">
                  {read.map((n) => (
                    <NotificationItem key={n.id} notification={n} onClick={handleClick} />
                  ))}
                </motion.div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
