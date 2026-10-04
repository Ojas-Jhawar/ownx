// Question bank + device-check commands for the AI Diagnose survey.
// Kept as plain data (no JSX) so it can be imported by both the client
// component and, if needed later, a server action for validation.

export type QuestionType = "select" | "radio"

export interface DiagnoseQuestion {
  id: string
  label: string
  type: QuestionType
  options: { value: string; label: string }[]
}

const GENERAL_QUESTIONS: DiagnoseQuestion[] = [
  {
    id: "usage_frequency",
    label: "How often do you use it?",
    type: "radio",
    options: [
      { value: "daily", label: "Daily" },
      { value: "weekly", label: "A few times a week" },
      { value: "rarely", label: "Rarely" },
      { value: "unused", label: "Sitting unused" },
    ],
  },
  {
    id: "visible_damage",
    label: "Any visible damage — cracks, dents, scratches?",
    type: "radio",
    options: [
      { value: "none", label: "None, looks new" },
      { value: "minor", label: "Minor cosmetic wear" },
      { value: "moderate", label: "Noticeable damage" },
      { value: "severe", label: "Significant/structural damage" },
    ],
  },
  {
    id: "performance",
    label: "How does it perform compared to when it was new?",
    type: "radio",
    options: [
      { value: "same", label: "Same as new" },
      { value: "slightly_slower", label: "A little slower / weaker" },
      { value: "noticeably_worse", label: "Noticeably worse" },
      { value: "barely_works", label: "Barely usable" },
    ],
  },
  {
    id: "repairs_so_far",
    label: "Has it needed any repairs so far?",
    type: "radio",
    options: [
      { value: "none", label: "No repairs" },
      { value: "minor", label: "One minor repair" },
      { value: "multiple", label: "Multiple repairs" },
    ],
  },
]

const CATEGORY_QUESTIONS: Record<string, DiagnoseQuestion[]> = {
  laptop: [
    {
      id: "battery_backup",
      label: "Roughly how long does the battery last on a full charge now?",
      type: "radio",
      options: [
        { value: "full_day", label: "Still a full day" },
        { value: "half_day", label: "Around half a day" },
        { value: "few_hours", label: "A couple of hours" },
        { value: "plugged_in_only", label: "Only works plugged in" },
      ],
    },
    {
      id: "thermals",
      label: "Does it run hot or the fan spin loudly under normal use?",
      type: "radio",
      options: [
        { value: "no", label: "No, stays cool and quiet" },
        { value: "sometimes", label: "Sometimes, under heavy load" },
        { value: "often", label: "Often, even for light tasks" },
      ],
    },
    {
      id: "storage_type",
      label: "Storage type (if you know it)",
      type: "select",
      options: [
        { value: "unknown", label: "Not sure" },
        { value: "ssd", label: "SSD" },
        { value: "hdd", label: "HDD (spinning disk)" },
      ],
    },
  ],
  smartphone: [
    {
      id: "battery_backup",
      label: "Roughly how long does the battery last on a full charge now?",
      type: "radio",
      options: [
        { value: "full_day", label: "Still a full day" },
        { value: "half_day", label: "Around half a day" },
        { value: "few_hours", label: "A couple of hours" },
        { value: "drains_fast", label: "Drains within an hour or two" },
      ],
    },
    {
      id: "screen_condition",
      label: "Screen condition",
      type: "radio",
      options: [
        { value: "perfect", label: "Perfect, no marks" },
        { value: "scratched", label: "Scratched but functional" },
        { value: "cracked", label: "Cracked glass" },
        { value: "display_issue", label: "Display glitches / dead pixels" },
      ],
    },
    {
      id: "charging_port",
      label: "Charging port / wireless charging",
      type: "radio",
      options: [
        { value: "fine", label: "Works fine" },
        { value: "loose", label: "Loose / needs repositioning" },
        { value: "not_working", label: "Doesn't charge reliably" },
      ],
    },
  ],
  audio: [
    {
      id: "sound_quality",
      label: "Sound quality in both ears/channels",
      type: "radio",
      options: [
        { value: "even", label: "Clear and even" },
        { value: "one_side_weak", label: "One side is weaker" },
        { value: "distorted", label: "Distorted or crackling" },
        { value: "silent", label: "One side is silent" },
      ],
    },
    {
      id: "connectivity",
      label: "Bluetooth / connectivity",
      type: "radio",
      options: [
        { value: "stable", label: "Connects instantly, stays stable" },
        { value: "drops", label: "Occasionally drops" },
        { value: "wont_pair", label: "Struggles to pair / frequent drops" },
      ],
    },
    {
      id: "battery_backup",
      label: "Battery life per charge (if wireless)",
      type: "radio",
      options: [
        { value: "na", label: "Not applicable / wired" },
        { value: "as_advertised", label: "Close to original" },
        { value: "reduced", label: "Noticeably reduced" },
        { value: "barely_holds", label: "Barely holds a charge" },
      ],
    },
  ],
  appliance: [
    {
      id: "core_function",
      label: "How well does it do its main job (suction/cooling/heating/etc)?",
      type: "radio",
      options: [
        { value: "full_power", label: "Full power, no complaints" },
        { value: "reduced", label: "Noticeably reduced" },
        { value: "struggling", label: "Struggling to do the job" },
      ],
    },
    {
      id: "noise",
      label: "Any unusual noise or vibration?",
      type: "radio",
      options: [
        { value: "no", label: "No" },
        { value: "occasional", label: "Occasionally" },
        { value: "constant", label: "Constant / getting worse" },
      ],
    },
  ],
  other: [
    {
      id: "functions_as_expected",
      label: "Does it still do everything it's meant to?",
      type: "radio",
      options: [
        { value: "fully", label: "Yes, fully" },
        { value: "mostly", label: "Mostly, with minor issues" },
        { value: "partially", label: "Only partially" },
        { value: "no", label: "No, mostly unusable" },
      ],
    },
  ],
}

// Maps an asset's free-text `category` (e.g. from invoice extraction) onto
// one of the question sets above.
export function normalizeCategory(category: string | null): keyof typeof CATEGORY_QUESTIONS {
  const c = (category || "").toLowerCase()
  if (/laptop|notebook|macbook|desktop|pc\b|computer/.test(c)) return "laptop"
  if (/phone|iphone|smartphone|tablet|ipad/.test(c)) return "smartphone"
  if (/headphone|earbud|earphone|speaker|audio/.test(c)) return "audio"
  if (/vacuum|fridge|refrigerator|washing|microwave|ac\b|air condition|appliance|oven|cooler|heater/.test(c))
    return "appliance"
  return "other"
}

export function getDiagnoseQuestions(category: string | null): DiagnoseQuestion[] {
  const key = normalizeCategory(category)
  return [...GENERAL_QUESTIONS, ...CATEGORY_QUESTIONS[key]]
}

export function needsDeviceCheck(category: string | null): boolean {
  const key = normalizeCategory(category)
  return key === "laptop" || key === "smartphone"
}

export interface DeviceCommandOption {
  os: string
  label: string
  command: string
  help: string
}

// Real commands the user can run themselves — nothing here executes on our
// servers or the app's own machine; the user runs it locally and pastes the
// output back in, and the AI reads that output as evidence.
export function getDeviceCommands(category: string | null): DeviceCommandOption[] {
  const key = normalizeCategory(category)
  if (key === "laptop") {
    return [
      {
        os: "Windows",
        label: "Windows (PowerShell / Command Prompt)",
        command: "powercfg /batteryreport /output \"$env:USERPROFILE\\Desktop\\battery-report.html\"",
        help: "Opens a full battery report on your Desktop — check the 'Design Capacity' vs 'Full Charge Capacity' numbers near the top and paste them below.",
      },
      {
        os: "macOS",
        label: "macOS (Terminal)",
        command: "system_profiler SPPowerDataType",
        help: "Paste the 'Cycle Count', 'Condition', and 'Maximum Capacity' lines from the output.",
      },
      {
        os: "Linux",
        label: "Linux (Terminal)",
        command: "upower -i $(upower -e | grep BAT)",
        help: "Paste the 'state', 'energy-full', 'energy-full-design', and 'capacity' lines.",
      },
    ]
  }
  if (key === "smartphone") {
    return [
      {
        os: "iOS",
        label: "iPhone",
        command: "Settings → Battery → Battery Health & Charging",
        help: "Paste the 'Maximum Capacity' percentage shown there (e.g. '87%').",
      },
      {
        os: "Android",
        label: "Android",
        command: "Settings → Battery → Battery health/usage (varies by brand), or dial *#*#4636#*#*",
        help: "Paste whatever battery health/capacity info your phone shows.",
      },
    ]
  }
  return []
}
