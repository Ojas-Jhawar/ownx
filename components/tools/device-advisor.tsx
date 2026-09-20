"use client"

import { useMemo, useState } from "react"
import { Wrench, ShoppingBag, ArrowUpCircle, Store, Recycle, CheckCircle2 } from "lucide-react"
import { SCRAP_PROFILES, type ScrapCategory } from "@/lib/scrap-rates"
import { getDeviceAdvice, PRIMARY_ACTION_LABELS, type PrimaryAction } from "@/lib/device-advisor"

const ACTION_META: Record<PrimaryAction, { icon: typeof Wrench; tone: string }> = {
  buy_new: { icon: ShoppingBag, tone: "text-brand" },
  upgrade: { icon: ArrowUpCircle, tone: "text-brand" },
  repair: { icon: Wrench, tone: "text-amber-600" },
  buy_2nd_hand: { icon: Store, tone: "text-brand" },
  keep_using: { icon: CheckCircle2, tone: "text-emerald-600" },
  sell_2nd_hand: { icon: Store, tone: "text-brand" },
  recycle_for_parts: { icon: Recycle, tone: "text-amber-600" },
}

// One form, one decision — instead of separate "what's it worth" and
// "should I fix it" tools that ask for half of the same information twice.
// Prefill props let this same component be reused inside a logged-in
// asset's passport page — pass the asset's category/condition/purchase data
// down and it behaves identically to the public standalone tool.
export function DeviceAdvisor({
  defaultCategory = "laptop",
  defaultWeightKg,
  defaultConditionScore = 60,
  defaultAgeYears,
  defaultPurchasePrice,
  defaultPurchaseDate,
  defaultNewPrice,
  defaultRepairCost,
}: {
  defaultCategory?: ScrapCategory
  defaultWeightKg?: number
  defaultConditionScore?: number
  defaultAgeYears?: number
  defaultPurchasePrice?: number
  defaultPurchaseDate?: string
  defaultNewPrice?: number
  defaultRepairCost?: number
}) {
  const [category, setCategory] = useState<ScrapCategory>(defaultCategory)
  const [weightKg, setWeightKg] = useState(defaultWeightKg ? String(defaultWeightKg) : "")
  const [conditionScore, setConditionScore] = useState(String(defaultConditionScore))
  const [ageYears, setAgeYears] = useState(defaultAgeYears !== undefined ? String(defaultAgeYears) : "")
  const [purchasePrice, setPurchasePrice] = useState(defaultPurchasePrice ? String(defaultPurchasePrice) : "")
  const [purchaseDate, setPurchaseDate] = useState(defaultPurchaseDate || "")
  const [newPrice, setNewPrice] = useState(defaultNewPrice ? String(defaultNewPrice) : "")
  const [repairCost, setRepairCost] = useState(defaultRepairCost ? String(defaultRepairCost) : "")

  const advice = useMemo(
    () =>
      getDeviceAdvice({
        category,
        weightKg: weightKg ? Number(weightKg) : null,
        conditionScore: Number(conditionScore) || 0,
        ageYears: ageYears ? Number(ageYears) : null,
        purchasePrice: purchasePrice ? Number(purchasePrice) : null,
        purchaseDate: purchaseDate || null,
        newPriceINR: newPrice ? Number(newPrice) : null,
        repairCostINR: repairCost ? Number(repairCost) : null,
      }),
    [category, weightKg, conditionScore, ageYears, purchasePrice, purchaseDate, newPrice, repairCost],
  )

  const meta = ACTION_META[advice.primaryAction]
  const Icon = meta.icon

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold text-ink">About the device</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ScrapCategory)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {Object.entries(SCRAP_PROFILES).map(([key, p]) => (
                  <option key={key} value={key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Weight (kg) — leave blank to use a typical {SCRAP_PROFILES[category].avgWeightKg} kg
              </label>
              <input
                type="number"
                step="0.01"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder={String(SCRAP_PROFILES[category].avgWeightKg)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Condition: {conditionScore}/100</label>
              <input
                type="range"
                min={0}
                max={100}
                value={conditionScore}
                onChange={(e) => setConditionScore(e.target.value)}
                className="mt-2 w-full accent-brand"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Age (years, optional)</label>
                <input
                  type="number"
                  step="0.5"
                  value={ageYears}
                  onChange={(e) => setAgeYears(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Purchase date (optional)</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">What you paid for it (₹, optional)</label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold text-ink">Thinking of repairing or replacing it?</h2>
          <p className="mt-1 text-xs text-muted-foreground">Optional — fill these in to also get a repair-vs-replace recommendation.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">New equivalent price (₹)</label>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Repair quote (₹)</label>
              <input
                type="number"
                value={repairCost}
                onChange={(e) => setRepairCost(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-brand/30 bg-brand-soft/60 p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommendation</p>
          <div className="mt-2 flex items-center gap-2">
            <Icon className={`size-6 ${meta.tone}`} />
            <p className="text-xl font-semibold text-ink">{PRIMARY_ACTION_LABELS[advice.primaryAction]}</p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{advice.primaryDetail}</p>

          {advice.disposal && (
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What to do with the old one</p>
              <p className="mt-1 text-sm font-medium text-ink">{advice.disposal.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{advice.disposal.detail}</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scrap / recycle value</p>
          <p className="mt-1 text-3xl font-semibold text-ink">₹{advice.scrap.scrapValueINR.toLocaleString("en-IN")}</p>
          <p className="mt-1 text-xs text-muted-foreground">Based on ~{advice.scrap.weightUsedKg.toFixed(2)} kg of materials</p>
          <div className="mt-4 space-y-2">
            {advice.scrap.scrapBreakdown.map((m) => (
              <div key={m.name} className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">
                  {m.name}
                  {m.kind === "weight" && m.weightKg !== undefined && (
                    <span className="ml-1 text-xs text-muted-foreground">({(m.weightKg * 1000).toFixed(0)} g)</span>
                  )}
                  {m.kind === "precious" && m.grams !== undefined && (
                    <span className="ml-1 text-xs text-muted-foreground">({m.grams} g trace)</span>
                  )}
                </span>
                <span className="font-medium text-ink">₹{Math.round(m.valueINR).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        </div>

        {advice.scrap.resaleEstimateINR !== null && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimated 2nd-hand resale value</p>
            <p className="mt-1 text-2xl font-semibold text-ink">₹{advice.scrap.resaleEstimateINR.toLocaleString("en-IN")}</p>
          </div>
        )}

        {advice.repair?.repairCostRatio !== null && advice.repair?.repairCostRatio !== undefined && (
          <p className="text-xs text-muted-foreground">
            Repair cost is {Math.round(advice.repair.repairCostRatio * 100)}% of a new unit's price.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Rough heuristic, not financial advice — brand loyalty, urgency, and remaining warranty matter too.
        </p>
      </div>
    </div>
  )
}
