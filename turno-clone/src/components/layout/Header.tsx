"use client"
import { useAuth } from "@/components/layout/Providers"
import { Avatar } from "@/components/ui/Avatar"
import { Bell } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"

interface HeaderProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}

type NotifPreview = {
  id: string
  title: string
  message: string
  read: boolean
  createdAt: string
  jobId?: string | null
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotifPreview[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        const notifs: NotifPreview[] = d.notifications ?? []
        setNotifications(notifs.slice(0, 5))
        setUnreadCount(d.unreadCount ?? notifs.filter((n) => !n.read).length)
      })
      .catch(() => {})
  }, [user])

  function handleClick(n: NotifPreview) {
    setNotifOpen(false)
    // Mark as read
    if (!n.read) {
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => {})
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    // Navigate
    const title = n.title.toLowerCase()
    if (n.jobId) {
      router.push(`/jobs/${n.jobId}`)
    } else if (title.includes("supply") || title.includes("supplies")) {
      router.push("/supply-requests")
    } else if (title.includes("issue")) {
      router.push("/issues")
    } else if (title.includes("job") || title.includes("cleaner") || title.includes("assign")) {
      router.push("/jobs")
    } else {
      router.push("/notifications")
    }
  }

  return (
    <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-20">
      <div>
        {title && <h1 className="text-lg font-semibold text-slate-900">{title}</h1>}
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {actions}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <Bell className={`w-4 h-4 transition-transform ${notifOpen ? "scale-110" : ""}`} />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  key="dot"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full"
                />
              )}
            </AnimatePresence>
          </button>

          <AnimatePresence>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-20 overflow-hidden"
                >
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-6 text-sm text-slate-400 text-center">No notifications yet</p>
                    ) : (
                      notifications.map((n, i) => (
                        <motion.button
                          key={n.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => handleClick(n)}
                          className={`w-full text-left p-4 hover:bg-slate-50 transition-colors group ${!n.read ? "bg-blue-50/40" : ""}`}
                        >
                          <div className="flex items-start gap-2">
                            {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-700 transition-colors">{n.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                              <p className="text-xs text-slate-400 mt-1">
                                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        </motion.button>
                      ))
                    )}
                  </div>
                  <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                    <Link
                      href="/notifications"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold w-full text-center block transition-colors"
                    >
                      View all notifications →
                    </Link>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* User avatar */}
        {user && (
          <Link href="/settings">
            <Avatar name={user.name} src={user.avatarUrl} size="sm" />
          </Link>
        )}
      </div>
    </header>
  )
}
