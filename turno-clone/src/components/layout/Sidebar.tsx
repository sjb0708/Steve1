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
  DollarSign,
  Settings,
  LogOut,
  Sparkles,
  ChevronRight,
  Menu,
  X,
} from "lucide-react"
import { useState } from "react"

const hostNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/marketplace", label: "Find Cleaners", icon: Users },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/settings", label: "Settings", icon: Settings },
]

const cleanerNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "My Jobs", icon: Briefcase },
  { href: "/marketplace", label: "Find Jobs", icon: Users },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/earnings", label: "Earnings", icon: DollarSign },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = user?.role === "CLEANER" ? cleanerNav : hostNav

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-blue-800/50">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-blue-200" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">BDG Cleaning</p>
          </div>
        </Link>
      </div>

      {/* Role badge */}
      <div className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-800/60 text-blue-200 text-xs font-medium rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 status-pulse" />
          {user?.role === "CLEANER" ? "Cleaner Account" : "Host Account"}
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
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full bg-gradient-to-b from-blue-900 to-blue-950 shadow-2xl animate-slide-in-left">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-blue-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <NavContent />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 h-screen bg-gradient-to-b from-blue-900 to-blue-950 fixed left-0 top-0 z-30 shadow-xl">
        <NavContent />
      </aside>
    </>
  )
}
