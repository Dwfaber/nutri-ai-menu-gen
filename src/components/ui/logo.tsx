import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function Logo({ className, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl", 
    lg: "text-3xl"
  }

  return (
    <div className={cn("flex items-center gap-2 font-bold", className)}>
      <div className={cn("flex items-center", sizeClasses[size])}>
        <span className="text-primary">Nutri's</span>
        <span className="text-secondary ml-1">IA</span>
      </div>
    </div>
  )
}