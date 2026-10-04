import { ArrowRight, IdCard, FileScan, ShieldCheck, History, Gauge, BadgeCheck, Send, Lightbulb, Recycle } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

const FEATURES = [
  { icon: IdCard, title: "Ownership Passport", copy: "A permanent record of your asset." },
  { icon: FileScan, title: "AI Invoice Extraction", copy: "Turn documents into structured data." },
  { icon: ShieldCheck, title: "Warranty Tracking", copy: "Know what's still protected." },
  { icon: History, title: "Service History", copy: "Keep every repair in one timeline." },
  { icon: Gauge, title: "AI Condition Score", copy: "Turn condition into something measurable." },
  { icon: BadgeCheck, title: "Verified Resale", copy: "Share history instead of making claims." },
  { icon: Send, title: "Ownership Transfer", copy: "Pass the passport to the next owner." },
  { icon: Lightbulb, title: "Repair-vs-Replace Advisor", copy: "Get smart suggestions for your asset." },
  { icon: Recycle, title: "Circularity Score", copy: "Track the life extended by every repair." },
]

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 py-16 text-center sm:py-20">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Everything your asset needs.
            <br className="hidden sm:block" /> In one place.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            A complete toolkit for capturing, protecting and proving the life of everything you own.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-16">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{f.copy}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
                  Learn more <ArrowRight className="size-4" />
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
