"use client"
import { useAuth } from "@/components/layout/Providers"
import { Avatar } from "@/components/ui/Avatar"
import { Bell, Search } from "lucide-react"
import { useState } from "react"
import Link from "next/link"

interface HeaderProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { user } = useAuth()
  const [notifOpen, setNotifOpen] = useState(false)

  const notifications = [
    { id: 1, message: "New cleaning job assigned at Oceanview Retreat", time: "5 min ago", unread: true },
    { id: 2, message: "Sarah Johnson left you a 5-star review", time: "1 hour ago", unread: true },
    { id: 3, message: "Upcoming cleaning at Downtown Loft in 2 hours", time: "2 hours ago", unread: false },
  ]

  const unreadCount = notifications.filter((n) => n.unread).length

  return (
    <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-20">
      <div>
        {title && <h1 className="text-lg font-semibold text-slate-900">{title}</h1>}
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {actions}

        {/* Search */}
        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
          <Search className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full" />
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-20 animate-scale-in">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <p className="text-xs text-blue-600">{unreadCount} unread</p>
                  )}
                </div>
                <div className="divide-y divide-slate-50">
                  {notifications.map((n) => (
                    <div key={n.id} className={`p-4 hover:bg-slate-50 transition-colors ${n.unread ? "bg-blue-50/50" : ""}`}>
                      <p className="text-sm text-slate-700">{n.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{n.time}</p>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-slate-100">
                  <button className="text-xs text-blue-600 hover:text-blue-700 font-medium w-full text-center">
                    View all notifications
                  </button>
                </div>
              </div>
            </>
          )}
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
