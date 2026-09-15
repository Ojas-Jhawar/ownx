import { Upload, Layers, RotateCw } from "lucide-react"
import { Eyebrow } from "@/components/ui-kit"

const STEPS = [
  { icon: Upload, title: "Capture", copy: "Upload an invoice or scan your product." },
  { icon: Layers, title: "Build", copy: "Ownx creates your Ownership Passport." },
  { icon: RotateCw, title: "Maintain", copy: "Keep its history alive for as long as you own it." },
]

export function Process() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20 lg:py-24">
        <Eyebrow>From purchase to passport</Eyebrow>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Three steps to a verified record.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <s.icon className="size-5" />
                </span>
                <span className="text-sm font-semibold text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
