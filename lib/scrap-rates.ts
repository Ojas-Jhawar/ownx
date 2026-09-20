// Config, not gospel — scrap metal and precious-metal prices move; treat
// this as a starting point to tune against a real scrap dealer/recycler
// quote, not a fixed truth.
//
// Two kinds of material:
//  - `weight`: a % share of the device's total weight, priced per kg (bulk
//    metals/plastics/glass/battery cells).
//  - `precious`: a fixed trace amount in GRAMS regardless of device weight —
//    gold/palladium/silver plating on connectors and PCB pads doesn't scale
//    with how heavy the housing is, so modelling it as a % of weight would
//    be dishonest. Priced per gram.

export type ScrapCategory = "laptop" | "smartphone" | "audio" | "appliance" | "other"

export interface WeightMaterial {
  name: string
  kind: "weight"
  pctOfWeight: number // shares within a category should sum to ~1
  ratePerKgINR: number
}

export interface PreciousMaterial {
  name: string
  kind: "precious"
  grams: number // trace amount per device, not per kg
  ratePerGramINR: number
}

export type Material = WeightMaterial | PreciousMaterial

export interface CategoryProfile {
  label: string
  avgWeightKg: number
  materials: Material[]
}

// Blended recovery rate for gold/palladium/silver traces pulled from
// connectors, PCB pads and IC packages. Real recyclers pay well below spot
// price because recovery is chemical/labour-intensive — this rate already
// accounts for that, don't multiply by spot gold price directly.
const PRECIOUS_RATE_PER_GRAM_INR = 5500

export const SCRAP_PROFILES: Record<ScrapCategory, CategoryProfile> = {
  laptop: {
    label: "Laptop",
    avgWeightKg: 1.8,
    materials: [
      { name: "Aluminium / steel chassis", kind: "weight", pctOfWeight: 0.35, ratePerKgINR: 150 },
      { name: "Plastic housing", kind: "weight", pctOfWeight: 0.2, ratePerKgINR: 15 },
      { name: "Copper (wiring / heatsink)", kind: "weight", pctOfWeight: 0.05, ratePerKgINR: 550 },
      { name: "Battery pack (lithium-ion cells)", kind: "weight", pctOfWeight: 0.12, ratePerKgINR: 90 },
      { name: "Screen / display panel (glass)", kind: "weight", pctOfWeight: 0.13, ratePerKgINR: 20 },
      { name: "Other (fans, cabling, misc)", kind: "weight", pctOfWeight: 0.15, ratePerKgINR: 10 },
      { name: "Gold / palladium plating (connectors, PCB)", kind: "precious", grams: 0.025, ratePerGramINR: PRECIOUS_RATE_PER_GRAM_INR },
    ],
  },
  smartphone: {
    label: "Smartphone",
    avgWeightKg: 0.18,
    materials: [
      { name: "Aluminium / steel frame", kind: "weight", pctOfWeight: 0.28, ratePerKgINR: 140 },
      { name: "Glass (screen + back)", kind: "weight", pctOfWeight: 0.22, ratePerKgINR: 8 },
      { name: "Battery pack (lithium-ion cell)", kind: "weight", pctOfWeight: 0.2, ratePerKgINR: 90 },
      { name: "Plastic / other", kind: "weight", pctOfWeight: 0.2, ratePerKgINR: 15 },
      { name: "Camera modules & misc metal", kind: "weight", pctOfWeight: 0.1, ratePerKgINR: 60 },
      { name: "Gold / palladium plating (connectors, PCB)", kind: "precious", grams: 0.034, ratePerGramINR: PRECIOUS_RATE_PER_GRAM_INR },
    ],
  },
  audio: {
    label: "Audio device (headphones / earbuds / speaker)",
    avgWeightKg: 0.3,
    materials: [
      { name: "Plastic housing", kind: "weight", pctOfWeight: 0.45, ratePerKgINR: 15 },
      { name: "Copper (coils / wiring)", kind: "weight", pctOfWeight: 0.15, ratePerKgINR: 550 },
      { name: "Battery pack (lithium-ion, if wireless)", kind: "weight", pctOfWeight: 0.15, ratePerKgINR: 90 },
      { name: "Rare-earth magnets (drivers)", kind: "weight", pctOfWeight: 0.15, ratePerKgINR: 300 },
      { name: "Other metal", kind: "weight", pctOfWeight: 0.1, ratePerKgINR: 60 },
      { name: "Gold-plated connectors / PCB", kind: "precious", grams: 0.008, ratePerGramINR: PRECIOUS_RATE_PER_GRAM_INR },
    ],
  },
  appliance: {
    label: "Appliance",
    avgWeightKg: 8,
    materials: [
      { name: "Steel body", kind: "weight", pctOfWeight: 0.55, ratePerKgINR: 35 },
      { name: "Copper (motor / coils)", kind: "weight", pctOfWeight: 0.12, ratePerKgINR: 550 },
      { name: "Aluminium", kind: "weight", pctOfWeight: 0.1, ratePerKgINR: 150 },
      { name: "Plastic / other", kind: "weight", pctOfWeight: 0.18, ratePerKgINR: 15 },
      { name: "Rare-earth / misc metal", kind: "weight", pctOfWeight: 0.05, ratePerKgINR: 60 },
      { name: "Gold-plated PCB (control board)", kind: "precious", grams: 0.01, ratePerGramINR: PRECIOUS_RATE_PER_GRAM_INR },
    ],
  },
  other: {
    label: "Other",
    avgWeightKg: 1,
    materials: [
      { name: "Mixed metal", kind: "weight", pctOfWeight: 0.4, ratePerKgINR: 60 },
      { name: "Plastic / other", kind: "weight", pctOfWeight: 0.55, ratePerKgINR: 15 },
      { name: "Battery (if applicable)", kind: "weight", pctOfWeight: 0.05, ratePerKgINR: 90 },
      { name: "Gold-plated PCB (if applicable)", kind: "precious", grams: 0.005, ratePerGramINR: PRECIOUS_RATE_PER_GRAM_INR },
    ],
  },
}
