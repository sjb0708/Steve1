"use client"
import { cn } from "@/lib/utils"
import { type SelectHTMLAttributes, forwardRef } from "react"
import { ChevronDown } from "lucide-react"

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options, placeholder, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-")

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={cn(
              "w-full px-3 py-2.5 pr-10 text-sm text-slate-900 bg-white border rounded-xl appearance-none",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
              "disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed",
              error ? "border-red-400" : "border-slate-200 hover:border-slate-300",
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    )
  }
)

Select.displayName = "Select"
