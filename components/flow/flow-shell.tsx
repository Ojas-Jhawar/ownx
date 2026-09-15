import type { ReactNode } from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"

const STEPS = ["Method", "Upload", "Processing", "Review", "Passport"]

export function FlowShell({
  children,
  currentStep,
  backHref,
}: {
  children: ReactNode
  currentStep?: number
  backHref?: string
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Logo href="/" />
          {typeof currentStep === "number" && (
            <ol className="hidden items-center gap-2 sm:flex" aria-label="Progress">
              {STEPS.map((label, i) => {
                const done = i < currentStep
                const active = i === currentStep
                return (
                  <li key={label} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-[11px] font-semibold transition-colors",
                        done && "bg-brand text-brand-foreground",
                        active && "border-2 border-brand text-brand",
                        !done && !active && "border border-border text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="size-3.5" /> : i + 1}
                    </span>
                    {i < STEPS.length - 1 && (
                      <span className={cn("h-px w-6 lg:w-10", done ? "bg-brand" : "bg-border")} />
                    )}
                  </li>
                )
              })}
            </ol>
          )}
          <Link href={backHref ?? "/dashboard"} className="text-sm text-muted-foreground transition-colors hover:text-ink">
            Save &amp; exit
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:py-14">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  )
}
