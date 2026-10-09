import type { ScrapCategory } from "./scrap-rates"

// Typical weights, good enough for an estimate. People can still type their own.
export const WEIGHT_PRESETS: Record<ScrapCategory, { label: string; kg: number }[]> = {
  laptop: [
    { label: "Ultrabook (13 in)", kg: 1.25 },
    { label: "Standard (14 to 15.6 in)", kg: 1.8 },
    { label: "Gaming / workstation", kg: 2.5 },
  ],
  smartphone: [
    { label: "Compact phone", kg: 0.17 },
    { label: "Standard phone", kg: 0.19 },
    { label: "Large phone / small tablet", kg: 0.23 },
    { label: "Tablet", kg: 0.47 },
  ],
  audio: [
    { label: "Earbuds + case", kg: 0.06 },
    { label: "Over-ear headphones", kg: 0.3 },
    { label: "Portable speaker", kg: 0.6 },
  ],
  appliance: [
    { label: "Mixer / small appliance", kg: 3 },
    { label: "Vacuum cleaner", kg: 5 },
    { label: "Microwave", kg: 12 },
    { label: "Washing machine", kg: 60 },
  ],
  other: [{ label: "Small gadget", kg: 0.5 }],
}
