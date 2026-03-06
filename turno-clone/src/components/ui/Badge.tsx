import { cn } from "@/lib/utils"
import { type HTMLAttributes } from "react"

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "blue" | "green" | "amber" | "red" | "purple" | "slate"
  size?: "sm" | "md"
  dot?: boolean
}

export function Badge({
  className,
  variant = "default",
  size = "sm",
  dot,
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    purple: "bg-purple-100 text-purple-700",
    slate: "bg-slate-100 text-slate-600",
  }

  const dotColors = {
    default: "bg-slate-500",
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    purple: "bg-purple-500",
    slate: "bg-slate-400",
  }

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full", dotColors[variant])} />
      )}
      {children}
    </span>
  )
}
