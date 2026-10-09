"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Recycle, Share2, Check, ArrowRight } from "lucide-react"
import { estimateScrapValue } from "@/lib/scrap-value"
import { WEIGHT_PRESETS } from "@/lib/weight-presets"
import type { CategoryProfile, ScrapCategory } from "@/lib/scrap-rates"

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`
const input =
  "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"

export function ScrapCalculator({
  profiles,
  defaults,
}: {
  profiles: Record<ScrapCategory, CategoryProfile>
  defaults: { category: ScrapCategory; weightKg: string; condition: string; purchaseDate: string; purchasePrice: string }
}) {
  const [category, setCategory] = useState<ScrapCategory>(defaults.category)
  const [weightKg, setWeightKg] = useState(defaults.weightKg)
  const [works, setWorks] = useState(true)
  const [condition, setCondition] = useState(defaults.condition)
  const [purchaseDate, setPurchaseDate] = useState(defaults.purchaseDate)
  const [purchasePrice, setPurchasePrice] = useState(defaults.purchasePrice)
  const [copied, setCopied] = useState(false)

  // A device that no longer works can't be scored as "good": cap it so the advice stays honest.
  const effectiveCondition = works ? Number(condition) || 0 : Math.min(Number(condition) || 0, 25)

  const result = useMemo(
    () =>
      estimateScrapValue({
        category,
        weightKg: weightKg ? Number(weightKg) : null,
        conditionScore: effectiveCondition,
        purchasePrice: purchasePrice ? Number(purchasePrice) : null,
        purchaseDate: purchaseDate || null,
        profiles,
      }),
    [category, weightKg, effectiveCondition, purchasePrice, purchaseDate, profiles],
  )

  async function share() {
    const p = new URLSearchParams({ category, condition, ...(weightKg && { weight: weightKg }), ...(purchaseDate && { date: purchaseDate }), ...(purchasePrice && { price: purchasePrice }) })
    await navigator.clipboard.writeText(`${window.location.origin}/tools/scrap-value?${p.toString()}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold text-ink">About the device</h2>
        <div>
          <label htmlFor="cat" className="text-xs font-medium text-muted-foreground">Category</label>
          <select id="cat" value={category} onChange={(e) => { setCategory(e.target.value as ScrapCategory); setWeightKg("") }} className={input}>
            {Object.entries(profiles).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="preset" className="text-xs font-medium text-muted-foreground">Typical size</label>
          <select id="preset" value="" onChange={(e) => e.target.value && setWeightKg(e.target.value)} className={input}>
            <option value="">Pick a typical weight…</option>
            {WEIGHT_PRESETS[category].map((p) => <option key={p.label} value={p.kg}>{p.label} (~{p.kg} kg)</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="weight" className="text-xs font-medium text-muted-foreground">Weight (kg), blank = typical {profiles[category].avgWeightKg} kg</label>
          <input id="weight" type="number" step="0.01" min="0" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={input} />
        </div>
        <fieldset>
          <legend className="text-xs font-medium text-muted-foreground">Does it still work?</legend>
          <div className="mt-2 flex gap-2">
            {[true, false].map((v) => (
              <button key={String(v)} type="button" onClick={() => setWorks(v)}
                className={works === v ? "rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-brand-foreground" : "rounded-full border border-border px-4 py-1.5 text-xs font-medium text-ink hover:bg-muted"}>
                {v ? "Yes, it works" : "No, it's dead / broken"}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="cond" className="text-xs font-medium text-muted-foreground">Condition: {effectiveCondition}/100{!works && " (capped, device is broken)"}</label>
          <input id="cond" type="range" min={0} max={100} value={condition} onChange={(e) => setCondition(e.target.value)} className="mt-2 w-full accent-brand" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="date" className="text-xs font-medium text-muted-foreground">Purchase date (optional)</label>
            <input id="date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="price" className="text-xs font-medium text-muted-foreground">Price paid ₹ (optional)</label>
            <input id="price" type="number" min="0" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className={input} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-brand/30 bg-brand-soft/60 p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimated scrap value</p>
          <p className="mt-1 text-3xl font-semibold text-ink">{inr(result.scrapRangeINR[0])} to {inr(result.scrapRangeINR[1])}</p>
          <p className="mt-1 text-xs text-muted-foreground">Based on ~{result.weightUsedKg.toFixed(2)} kg of materials. Recyclers pay differently, so treat this as a range.</p>
          {result.resaleRangeINR && (
            <p className="mt-4 text-sm text-ink-soft">Working resale value: <span className="font-semibold text-ink">{inr(result.resaleRangeINR[0])} to {inr(result.resaleRangeINR[1])}</span></p>
          )}
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Recycle className="size-4 text-brand" /> {result.recommendationLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">{result.recommendationDetail}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Material breakdown</p>
          <div className="mt-3 space-y-2">
            {result.scrapBreakdown.map((m) => (
              <div key={m.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-soft">{m.name}
                  {m.kind === "weight" && m.weightKg !== undefined && <span className="ml-1 text-xs text-muted-foreground">({(m.weightKg * 1000).toFixed(0)} g)</span>}
                  {m.kind === "precious" && <span className="ml-1 text-xs text-muted-foreground">({m.grams} g trace)</span>}
                </span>
                <span className="shrink-0 font-medium text-ink">{inr(Math.round(m.valueINR))}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-muted">
            {copied ? <Check className="size-4" /> : <Share2 className="size-4" />} {copied ? "Link copied" : "Share this result"}
          </button>
          <Link href="/create" className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground">
            Create a passport <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
