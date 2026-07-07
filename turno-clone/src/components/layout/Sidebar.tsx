"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/layout/Providers"
import { Avatar } from "@/components/ui/Avatar"
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  Users,
  Calendar,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Bell,
  BookOpen,
  DollarSign,
  TriangleAlert,
  TrendingUp,
  ShoppingCart,
} from "lucide-react"
import { useState, useEffect } from "react"

const adminNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bookings", label: "Bookings", icon: BookOpen },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/payments", label: "Payments", icon: DollarSign },
  { href: "/issues", label: "Issues", icon: TriangleAlert },
  { href: "/supply-requests", label: "Supplies", icon: ShoppingCart },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/users", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
]

const cleanerNav = [
  { href: "/dashboard", label: "My Jobs", icon: LayoutDashboard },
  { href: "/jobs", label: "All Jobs", icon: Briefcase },
  { href: "/payments", label: "Earnings", icon: TrendingUp },
  { href: "/issues", label: "My Reports", icon: TriangleAlert },
  { href: "/supply-requests", label: "My Requests", icon: ShoppingCart },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => setUnreadCount(d.unreadCount || 0))
      .catch(() => {})

    // Poll every 2 minutes
    const interval = setInterval(() => {
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((d) => setUnreadCount(d.unreadCount || 0))
        .catch(() => {})
    }, 120000)
    return () => clearInterval(interval)
  }, [user])

  const navItems = user?.role === "CLEANER" ? cleanerNav : adminNav

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  // Plain JSX value, not a nested component — defining a component inside
  // render remounts it (and loses state) on every parent render
  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-blue-800/50">
        <Link href="/dashboard" className="flex items-center gap-3">
          <img src="/logo.png" alt="Bailey Development Group" className="w-10 h-10 rounded-xl object-contain bg-white p-0.5" />
          <div>
            <p className="text-white font-bold text-sm leading-tight">Bailey</p>
            <p className="text-blue-300 text-xs leading-tight">Development Group</p>
          </div>
        </Link>
      </div>

      {/* Role badge */}
      <div className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-800/60 text-blue-200 text-xs font-medium rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          {user?.role === "CLEANER" ? "Cleaner" : "Admin"}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
                active
                  ? "bg-white/15 text-white"
                  : "text-blue-200 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className={cn("w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110", active && "text-blue-300")} />
              {label}
              {active && <ChevronRight className="w-3 h-3 ml-auto text-blue-300" />}
            </Link>
          )
        })}

        {/* Notifications link */}
        <Link
          href="/notifications"
          onClick={() => setMobileOpen(false)}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
            pathname === "/notifications"
              ? "bg-white/15 text-white"
              : "text-blue-200 hover:bg-white/10 hover:text-white"
          )}
        >
          <Bell className="w-4 h-4 flex-shrink-0" />
          Notifications
          {unreadCount > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
      </nav>

      {/* User section */}
      {user && (
        <div className="p-3 border-t border-blue-800/50">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/10 transition-colors">
            <Avatar name={user.name} src={user.avatarUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user.name}</p>
              <p className="text-blue-300 text-xs truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 mt-1 text-blue-300 hover:text-white hover:bg-white/10 rounded-xl text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-blue-900 text-white rounded-xl shadow-lg"
      >
        <Menu className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full bg-gradient-to-b from-blue-900 to-blue-950 shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-blue-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            {navContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 h-screen bg-gradient-to-b from-blue-900 to-blue-950 fixed left-0 top-0 z-30 shadow-xl">
        {navContent}
      </aside>
    </>
  )
}
