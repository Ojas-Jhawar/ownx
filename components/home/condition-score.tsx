import { Eyebrow } from "@/components/ui-kit"

const BARS = [
  { label: "Body", value: 91 },
  { label: "Display", value: 94 },
  { label: "Keyboard", value: 88 },
  { label: "Battery", value: 78 },
  { label: "Accessories", value: 84 },
]

export function ConditionScore() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20 lg:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Condition score</Eyebrow>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Replace &ldquo;lightly used&rdquo; with something you can trust.
          </h2>
        </div>

        <div className="mt-10 grid items-center gap-8 rounded-3xl border border-border bg-card p-8 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center justify-center rounded-2xl bg-brand-soft px-10 py-8 text-center">
            <div className="text-5xl font-semibold text-brand">87</div>
            <div className="text-sm text-brand/70">/100</div>
            <p className="mt-2 text-sm font-medium text-ink">Excellent condition</p>
          </div>

          <div className="space-y-4">
            {BARS.map((b) => (
              <div key={b.label}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-ink-soft">{b.label}</span>
                  <span className="font-medium text-ink">{b.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${b.value}%` }} />
                </div>
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              An AI-generated estimate. Final condition may vary.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
