import { Check, Eye, Infinity as InfinityIcon, HeartHandshake } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Eyebrow } from "@/components/ui-kit"

const WHY = [
  { icon: Eye, title: "Transparency", copy: "Real records. No guesswork." },
  { icon: InfinityIcon, title: "Continuity", copy: "History that lasts." },
  { icon: HeartHandshake, title: "Trust", copy: "A stronger resale ecosystem." },
]

const VISION = [
  "Every physical asset has a digital identity",
  "with a persistent history",
  "that survives ownership",
  "and makes the asset more valuable",
]

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <Eyebrow>About Ownx</Eyebrow>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Physical ownership deserves a digital identity.
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            We believe the things people own shouldn&apos;t lose their history simply because they change hands.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-16">
          <div className="rounded-3xl bg-ink p-8 text-white sm:p-12">
            <Eyebrow className="text-white/60">Our mission</Eyebrow>
            <p className="mt-3 max-w-2xl text-2xl font-medium leading-snug sm:text-3xl">
              Make ownership more transparent, portable and trustworthy.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-16">
          <h2 className="text-xl font-semibold tracking-tight text-ink">Why now?</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {WHY.map((w) => (
              <div key={w.title} className="rounded-2xl border border-border bg-card p-6">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <w.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold text-ink">{w.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{w.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="rounded-3xl border border-border bg-card p-8 sm:p-10">
            <h2 className="text-xl font-semibold tracking-tight text-ink">The bigger vision</h2>
            <ul className="mt-6 space-y-3">
              {VISION.map((v) => (
                <li key={v} className="flex items-center gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground">
                    <Check className="size-3.5" />
                  </span>
                  <span className="text-ink-soft">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
