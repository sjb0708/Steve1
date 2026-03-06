import { cn } from "@/lib/utils"
import { type LucideIcon } from "lucide-react"
import { Card } from "./Card"

interface StatCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: "positive" | "negative" | "neutral"
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  description?: string
  className?: string
}

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor = "text-blue-600",
  iconBg = "bg-blue-50",
  description,
  className,
}: StatCardProps) {
  const changeColors = {
    positive: "text-emerald-600",
    negative: "text-red-500",
    neutral: "text-slate-500",
  }

  return (
    <Card className={cn("animate-fade-in", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
          {(change || description) && (
            <p className={cn("text-xs mt-1", changeColors[changeType])}>
              {change || description}
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-xl flex-shrink-0", iconBg)}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
      </div>
    </Card>
  )
}
