import { BadgeCheck, ShieldCheck } from "lucide-react"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"

export function PassportCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-xl shadow-ink/10",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <Logo />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
          <BadgeCheck className="size-3.5" /> Verified
        </span>
      </div>

      <div className="mt-4 flex items-center gap-4 rounded-2xl bg-muted/60 p-4">
        <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-white shadow-sm">
          <svg width="34" height="24" viewBox="0 0 34 24" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="32" height="20" rx="2" stroke="currentColor" className="text-ink/40" strokeWidth="1.5" />
            <rect x="10" y="22" width="14" height="1.5" rx="0.75" className="fill-ink/30" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-ink">MacBook Pro 14&quot;</p>
          <p className="text-sm text-muted-foreground">Apple · Laptop</p>
        </div>
      </div>

      <dl className="mt-4 space-y-2.5 text-sm">
        {[
          ["Serial", "C02XXXXXXX"],
          ["Purchased", "12 Jan 2025"],
          ["Warranty", "16 months left"],
          ["Condition", "87 / 100"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-brand" /> Verified Passport
        </span>
        <span>1 Owner</span>
      </div>
    </div>
  )
}
