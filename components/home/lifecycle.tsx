import { ShoppingBag, ShieldCheck, Wrench, RefreshCw } from "lucide-react"
import { Section } from "@/components/ui-kit"

const STAGES = [
  { icon: ShoppingBag, title: "Purchase", copy: "Invoice + serial" },
  { icon: ShieldCheck, title: "Protect", copy: "Warranty tracking" },
  { icon: Wrench, title: "Maintain", copy: "Service history" },
  { icon: RefreshCw, title: "Resell", copy: "Verified ownership" },
]

export function Lifecycle() {
  return (
    <Section>
      <h2 className="text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        One record. Every stage of ownership.
      </h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((s) => (
          <div
            key={s.title}
            className="rounded-2xl border border-border bg-card p-6 text-center transition-shadow hover:shadow-md"
          >
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
              <s.icon className="size-6" />
            </span>
            <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.copy}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}
