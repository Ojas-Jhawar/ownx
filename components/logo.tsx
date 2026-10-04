import Link from "next/link"
import { cn } from "@/lib/utils"

export function Logo({
  className,
  href = "/",
  invert = false,
}: {
  className?: string
  href?: string
  invert?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}
    >
      <span
        className={cn(
          "grid size-7 place-items-center rounded-lg bg-brand text-brand-foreground",
          invert && "bg-white text-brand",
        )}
        aria-hidden="true"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2 3 6.5v6C3 18 7 21.5 12 23c5-1.5 9-5 9-10.5v-6L12 2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="m8.5 12 2.4 2.4L15.5 9.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={cn("text-lg", invert ? "text-white" : "text-ink")}>Ownx.</span>
    </Link>
  )
}
