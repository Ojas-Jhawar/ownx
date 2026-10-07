import { describe, it, expect } from "vitest"
import { warrantyDaysLeft } from "@/lib/warranty"
import { getRepairAdvice } from "@/lib/repair-advisor"
import { estimateScrapValue } from "@/lib/scrap-value"
import { maskSerial } from "@/lib/format"
import { generateOwnxId } from "@/lib/ownx-id"

describe("warrantyDaysLeft", () => {
  const now = new Date("2026-10-01T00:00:00Z")
  it("counts days to expiry", () => expect(warrantyDaysLeft("2025-11-01", 12, now)).toBe(31))
  it("is negative once expired", () => expect(warrantyDaysLeft("2024-01-01", 12, now)!).toBeLessThan(0))
  it("is null when data is missing", () => {
    expect(warrantyDaysLeft(null, 12, now)).toBeNull()
    expect(warrantyDaysLeft("2025-01-01", null, now)).toBeNull()
  })
})

describe("repair advisor", () => {
  it("repairs when the fix is cheap", () =>
    expect(getRepairAdvice({ ageYears: 2, condition: "good", newPriceINR: 50000, repairCostINR: 5000 }).action).toBe("repair"))
  it("replaces an old unit with a costly repair", () =>
    expect(getRepairAdvice({ ageYears: 4, condition: "fair", newPriceINR: 50000, repairCostINR: 35000 }).action).toBe("buy_new"))
})

describe("scrap value", () => {
  it("recycles a near-dead device", () =>
    expect(estimateScrapValue({ category: "laptop", conditionScore: 10 }).recommendation).toBe("recycle_for_parts"))
  it("never returns a negative value", () =>
    expect(estimateScrapValue({ category: "smartphone" }).scrapValueINR).toBeGreaterThan(0))
})

describe("ids and masking", () => {
  it("masks long serials", () => expect(maskSerial("C02ABCDE1234")).toBe("C0••••1234"))
  it("generates well-formed Ownx IDs", () => expect(generateOwnxId()).toMatch(/^OWNX-[A-HJ-NP-Z2-9]{8}$/))
})
