// A general "what should I do" advisor — independent of any specific owned
// asset, so it works for anonymous visitors deciding what to do before they
// even own the thing (or before they've logged their asset in Ownx).
// Deterministic heuristic, no AI call: fast, free, works offline.

export type Condition = "excellent" | "good" | "fair" | "poor" | "broken"

export interface RepairAdviceInput {
  ageYears: number
  condition: Condition
  newPriceINR: number
  repairCostINR?: number | null
}

export type RepairAdviceAction = "buy_new" | "upgrade" | "repair" | "buy_2nd_hand" | "keep_using"

export interface RepairAdviceResult {
  action: RepairAdviceAction
  title: string
  detail: string
  repairCostRatio: number | null
}

const CONDITION_SCORE: Record<Condition, number> = {
  excellent: 95,
  good: 75,
  fair: 50,
  poor: 25,
  broken: 5,
}

export function getRepairAdvice(input: RepairAdviceInput): RepairAdviceResult {
  const conditionScore = CONDITION_SCORE[input.condition]
  const repairCostRatio =
    input.repairCostINR && input.newPriceINR ? input.repairCostINR / input.newPriceINR : null

  // Broken or very old + poor condition → not worth chasing.
  if (input.condition === "broken" || (input.ageYears >= 5 && conditionScore < 40)) {
    if (repairCostRatio !== null && repairCostRatio < 0.25) {
      return {
        action: "repair",
        title: "Repair it — cheap fix relative to a new one",
        detail: `The repair is only about ${Math.round(repairCostRatio * 100)}% of a new unit's price — worth doing before you consider replacing it.`,
        repairCostRatio,
      }
    }
    return {
      action: "buy_new",
      title: "Time to buy new",
      detail: "It's old and in poor shape — repair cost (if you have an estimate) isn't clearly worth it, and reliability from here only gets worse.",
      repairCostRatio,
    }
  }

  // Cheap repair relative to new price is almost always the right call.
  if (repairCostRatio !== null && repairCostRatio <= 0.3 && conditionScore >= 40) {
    return {
      action: "repair",
      title: "Repair it",
      detail: `Repair cost is about ${Math.round(repairCostRatio * 100)}% of buying new — a clearly better deal while the rest of the device is still fine.`,
      repairCostRatio,
    }
  }

  // Expensive repair on an aging device → new is often better value than
  // sinking money into something already depreciating fast.
  if (repairCostRatio !== null && repairCostRatio > 0.6) {
    return {
      action: input.ageYears >= 3 ? "buy_new" : "buy_2nd_hand",
      title: input.ageYears >= 3 ? "Buy new instead of repairing" : "Consider a 2nd-hand unit instead",
      detail: `Repair cost is over ${Math.round(repairCostRatio * 100)}% of a new unit — ${
        input.ageYears >= 3
          ? "at that price, and given its age, a new (or certified refurbished) unit is the safer long-term value."
          : "but it's still fairly young — a verified 2nd-hand unit could get you similar value for less than new."
      }`,
      repairCostRatio,
    }
  }

  // Mid-life, decent condition, no strong repair signal → usually just keep
  // using it, unless it's genuinely old.
  if (input.ageYears >= 4 && conditionScore < 60) {
    return {
      action: "upgrade",
      title: "Consider upgrading",
      detail: "It's aging and performance has likely fallen off — an upgrade is reasonable even without a specific fault to point to.",
      repairCostRatio,
    }
  }

  return {
    action: "keep_using",
    title: "Keep using it",
    detail: "No strong signal to repair, replace or sell yet — condition and age are both still reasonable.",
    repairCostRatio,
  }
}

export const ACTION_LABELS: Record<RepairAdviceAction, string> = {
  buy_new: "Buy New",
  upgrade: "Upgrade",
  repair: "Repair",
  buy_2nd_hand: "Buy 2nd-Hand",
  keep_using: "Keep Using",
}
