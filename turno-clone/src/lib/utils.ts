import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow, isToday, isTomorrow, isPast } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "MMM d, yyyy")
}

export function formatDateShort(date: string | Date): string {
  const d = new Date(date)
  if (isToday(d)) return "Today"
  if (isTomorrow(d)) return "Tomorrow"
  return format(d, "MMM d")
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "MMM d, yyyy 'at' h:mm a")
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), "h:mm a")
}

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function isPastDate(date: string | Date): boolean {
  return isPast(new Date(date))
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function avatarUrl(name: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&size=128&bold=true`
}

export const STATUS_LABELS: Record<string, string> = {
  UNASSIGNED: "Needs Cleaner",
  PENDING_ACCEPTANCE: "Awaiting Confirmation",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  // legacy
  OPEN: "Needs Cleaner",
}

export const STATUS_COLORS: Record<string, string> = {
  UNASSIGNED: "bg-amber-100 text-amber-700",
  PENDING_ACCEPTANCE: "bg-purple-100 text-purple-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
  // legacy
  OPEN: "bg-amber-100 text-amber-700",
}

export const PLATFORM_COLORS: Record<string, string> = {
  AIRBNB: "bg-rose-100 text-rose-700",
  VRBO: "bg-blue-100 text-blue-700",
  MANUAL: "bg-slate-100 text-slate-700",
}
