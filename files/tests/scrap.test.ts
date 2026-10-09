import { describe, it, expect } from "vitest"
import { estimateScrapValue } from "@/lib/scrap-value"
import { SCRAP_PROFILES } from "@/lib/scrap-rates"

describe("scrap range", () => {
  it("brackets the point estimate", () => {
    const r = estimateScrapValue({ category: "laptop", weightKg: 1.8 })
    expect(r.scrapRangeINR[0]).toBeLessThan(r.scrapValueINR)
    expect(r.scrapRangeINR[1]).toBeGreaterThan(r.scrapValueINR)
  })
  it("uses overridden rates when profiles are passed", () => {
    const profiles = structuredClone(SCRAP_PROFILES)
    profiles.laptop.materials.forEach((m) => {
      if (m.kind === "weight") m.ratePerKgINR *= 2
    })
    const base = estimateScrapValue({ category: "laptop" }).scrapValueINR
    const doubled = estimateScrapValue({ category: "laptop", profiles }).scrapValueINR
    expect(doubled).toBeGreaterThan(base)
  })
  it("has no resale range without price and date", () => {
    expect(estimateScrapValue({ category: "audio" }).resaleRangeINR).toBeNull()
  })
})
