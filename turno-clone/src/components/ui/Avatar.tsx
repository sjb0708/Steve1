import { cn, getInitials } from "@/lib/utils"
import Image from "next/image"

interface AvatarProps {
  name: string
  src?: string | null
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeMap = {
  xs: { container: "w-6 h-6", text: "text-xs" },
  sm: { container: "w-8 h-8", text: "text-xs" },
  md: { container: "w-10 h-10", text: "text-sm" },
  lg: { container: "w-12 h-12", text: "text-base" },
  xl: { container: "w-16 h-16", text: "text-lg" },
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const { container, text } = sizeMap[size]

  if (src) {
    return (
      <div className={cn("relative rounded-full overflow-hidden flex-shrink-0", container, className)}>
        <Image
          src={src}
          alt={name}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full flex-shrink-0",
        "bg-gradient-to-br from-blue-500 to-blue-700 text-white font-bold",
        container,
        text,
        className
      )}
    >
      {getInitials(name)}
    </div>
  )
}
