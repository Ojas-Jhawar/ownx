import { estimateScrapValue, type ScrapEstimateResult } from "./scrap-value"
import { getRepairAdvice, type RepairAdviceResult, type RepairAdviceAction, type Condition, ACTION_LABELS } from "./repair-advisor"
import type { ScrapCategory } from "./scrap-rates"

export interface DeviceAdviceInput {
  category: ScrapCategory
  weightKg?: number | null
  conditionScore: number // 0-100 — single source of truth for "how good is it"
  ageYears?: number | null
  purchasePrice?: number | null
  purchaseDate?: string | null
  newPriceINR?: number | null // omit to skip the repair/replace half entirely
  repairCostINR?: number | null
}

export type PrimaryAction = RepairAdviceAction | "sell_2nd_hand" | "recycle_for_parts"

export interface DeviceAdviceResult {
  scrap: ScrapEstimateResult
  repair: RepairAdviceResult | null
  primaryAction: PrimaryAction
  primaryTitle: string
  primaryDetail: string
  /** Only set when the primary action means "replace it" — what to do with the old unit. */
  disposal: { action: "sell_2nd_hand" | "recycle_for_parts" | "keep_using"; label: string; detail: string } | null
}

function conditionScoreToLabel(score: number): Condition {
  if (score >= 85) return "excellent"
  if (score >= 65) return "good"
  if (score >= 40) return "fair"
  if (score >= 15) return "poor"
  return "broken"
}

const REPLACING_ACTIONS: RepairAdviceAction[] = ["buy_new", "upgrade", "buy_2nd_hand"]

/**
 * One holistic pass over both questions people actually have at the same
 * time: "should I fix/replace this?" and "what's this old one worth if I
 * do?" — instead of forcing two separate tools with two separate forms.
 */
export function getDeviceAdvice(input: DeviceAdviceInput): DeviceAdviceResult {
  const scrap = estimateScrapValue({
    category: input.category,
    weightKg: input.weightKg,
    conditionScore: input.conditionScore,
    purchasePrice: input.purchasePrice,
    purchaseDate: input.purchaseDate,
  })

  // No new-unit price given → we can only answer "what's it worth / should
  // you keep it," not "should you replace it." Answer that half honestly.
  if (!input.newPriceINR || input.ageYears === null || input.ageYears === undefined) {
    return {
      scrap,
      repair: null,
      primaryAction: scrap.recommendation,
      primaryTitle: scrap.recommendationLabel,
      primaryDetail: scrap.recommendationDetail,
      disposal: null,
    }
  }

  const repair = getRepairAdvice({
    ageYears: input.ageYears,
    condition: conditionScoreToLabel(input.conditionScore),
    newPriceINR: input.newPriceINR,
    repairCostINR: input.repairCostINR,
  })

  // Condition too far gone to responsibly repair/resell regardless of what
  // the repair-cost math says.
  if (input.conditionScore < 15) {
    return {
      scrap,
      repair,
      primaryAction: "recycle_for_parts",
      primaryTitle: "Recycle it for parts/metal",
      primaryDetail:
        "Condition is too far gone to responsibly repair, resell, or keep relying on — recycling the materials is the right call here.",
      disposal: null,
    }
  }

  if (repair.action === "keep_using" || repair.action === "repair") {
    return { scrap, repair, primaryAction: repair.action, primaryTitle: repair.title, primaryDetail: repair.detail, disposal: null }
  }

  // Replacing it (buy_new / upgrade / buy_2nd_hand) — also answer what to
  // do with the device being replaced.
  return {
    scrap,
    repair,
    primaryAction: repair.action,
    primaryTitle: repair.title,
    primaryDetail: repair.detail,
    disposal: { action: scrap.recommendation, label: scrap.recommendationLabel, detail: scrap.recommendationDetail },
  }
}

export function isReplacingAction(action: PrimaryAction): boolean {
  return REPLACING_ACTIONS.includes(action as RepairAdviceAction)
}

export const PRIMARY_ACTION_LABELS: Record<PrimaryAction, string> = {
  ...ACTION_LABELS,
  sell_2nd_hand: "Sell It 2nd-Hand",
  recycle_for_parts: "Recycle For Parts",
}
