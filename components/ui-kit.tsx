import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("text-xs font-semibold uppercase tracking-[0.18em] text-brand", className)}>{children}</span>
  )
}

export function Section({
  children,
  className,
  dark = false,
}: {
  children: ReactNode
  className?: string
  dark?: boolean
}) {
  return (
    <section className={cn(dark && "bg-ink text-white", className)}>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20 lg:py-24">{children}</div>
    </section>
  )
}

export function Pill({
  children,
  tone = "brand",
  className,
}: {
  children: ReactNode
  tone?: "brand" | "neutral" | "dark"
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "brand" && "bg-brand-soft text-brand",
        tone === "neutral" && "bg-muted text-muted-foreground",
        tone === "dark" && "bg-white/10 text-white",
        className,
      )}
    >
      {children}
    </span>
  )
}
