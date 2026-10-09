import { SCRAP_PROFILES, type ScrapCategory, type Material, type CategoryProfile } from "./scrap-rates"

export interface ScrapEstimateInput {
  category: ScrapCategory
  weightKg?: number | null // falls back to category average
  conditionScore?: number | null // 0-100
  purchasePrice?: number | null
  purchaseDate?: string | null // ISO date
  /** Rates loaded from the database. Defaults to the built-in profiles. */
  profiles?: Record<ScrapCategory, CategoryProfile>
}

export interface ScrapBreakdownLine {
  name: string
  kind: "weight" | "precious"
  weightKg?: number
  grams?: number
  valueINR: number
}

export interface ScrapEstimateResult {
  weightUsedKg: number
  scrapValueINR: number
  /** Honest range: recyclers pay differently, so show low to high, not one number. */
  scrapRangeINR: [number, number]
  scrapBreakdown: ScrapBreakdownLine[]
  resaleEstimateINR: number | null
  resaleRangeINR: [number, number] | null
  recommendation: "sell_2nd_hand" | "recycle_for_parts" | "keep_using"
  recommendationLabel: string
  recommendationDetail: string
}

export const SCRAP_RANGE_SPREAD = 0.15
export const RESALE_RANGE_SPREAD = 0.2

function monthsSince(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const start = new Date(dateStr)
  if (Number.isNaN(start.getTime())) return null
  const now = new Date()
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
}

function depreciationFactor(ageMonths: number): number {
  if (ageMonths <= 6) return 0.75
  if (ageMonths <= 12) return 0.6
  if (ageMonths <= 24) return 0.42
  if (ageMonths <= 36) return 0.28
  if (ageMonths <= 48) return 0.18
  return 0.1
}

function lineValue(m: Material, weightUsedKg: number): ScrapBreakdownLine {
  if (m.kind === "weight") {
    const weightKg = weightUsedKg * m.pctOfWeight
    return { name: m.name, kind: "weight", weightKg, valueINR: weightKg * m.ratePerKgINR }
  }
  return { name: m.name, kind: "precious", grams: m.grams, valueINR: m.grams * m.ratePerGramINR }
}

function range(value: number, spread: number): [number, number] {
  return [Math.round(value * (1 - spread)), Math.round(value * (1 + spread))]
}

export function estimateScrapValue(input: ScrapEstimateInput): ScrapEstimateResult {
  const profile = (input.profiles ?? SCRAP_PROFILES)[input.category]
  const weightUsedKg = input.weightKg && input.weightKg > 0 ? input.weightKg : profile.avgWeightKg

  const scrapBreakdown = profile.materials.map((m) => lineValue(m, weightUsedKg))
  const scrapValueINR = Math.round(scrapBreakdown.reduce((sum, l) => sum + l.valueINR, 0))

  const ageMonths = monthsSince(input.purchaseDate)
  let resaleEstimateINR: number | null = null
  if (input.purchasePrice && ageMonths !== null) {
    const conditionFactor =
      input.conditionScore !== null && input.conditionScore !== undefined
        ? Math.max(0.2, input.conditionScore / 100)
        : 0.7
    resaleEstimateINR = Math.round(input.purchasePrice * depreciationFactor(ageMonths) * conditionFactor)
  }

  const condition = input.conditionScore ?? null
  let recommendation: ScrapEstimateResult["recommendation"]
  let recommendationLabel: string
  let recommendationDetail: string

  if (condition !== null && condition < 35) {
    recommendation = "recycle_for_parts"
    recommendationLabel = "Recycle it for parts/metal"
    recommendationDetail =
      "Condition is low enough that a buyer would be a hard sell. Recycling the materials is the more reliable payout and keeps it out of landfill."
  } else if (resaleEstimateINR !== null && resaleEstimateINR > scrapValueINR * 1.3) {
    recommendation = "sell_2nd_hand"
    recommendationLabel = "Sell it 2nd-hand"
    recommendationDetail = `Its working resale value (~₹${resaleEstimateINR.toLocaleString("en-IN")}) is meaningfully higher than what it'd fetch for scrap (~₹${scrapValueINR.toLocaleString("en-IN")}).`
  } else if (condition !== null && condition >= 55) {
    recommendation = "keep_using"
    recommendationLabel = "Keep using it"
    recommendationDetail = "It's still in decent working condition. Neither the scrap nor resale numbers beat the value of continued use yet."
  } else {
    recommendation = "recycle_for_parts"
    recommendationLabel = "Recycle it for parts/metal"
    recommendationDetail =
      "Resale value is close to or below scrap value (or unknown), so recycling for materials is the more eco-friendly and often more profitable option."
  }

  return {
    weightUsedKg,
    scrapValueINR,
    scrapRangeINR: range(scrapValueINR, SCRAP_RANGE_SPREAD),
    scrapBreakdown,
    resaleEstimateINR,
    resaleRangeINR: resaleEstimateINR === null ? null : range(resaleEstimateINR, RESALE_RANGE_SPREAD),
    recommendation,
    recommendationLabel,
    recommendationDetail,
  }
}
