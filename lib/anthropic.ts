import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import type { InvoiceExtraction, DiagnosticReport } from "@/lib/types"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// The model is forced to call this tool, which pins the output to an exact
// shape — no free-form prose, no missing fields, no markdown fences to strip.
const EXTRACTION_TOOL = {
  name: "record_invoice_extraction",
  description: "Record the structured details extracted from a purchase invoice or receipt image.",
  input_schema: {
    type: "object" as const,
    properties: {
      product_name: fieldSchema("string", "Full product name, e.g. 'MacBook Pro 14-inch'"),
      brand: fieldSchema("string", "Manufacturer/brand, e.g. 'Apple'"),
      category: fieldSchema("string", "Product category, e.g. 'Laptop', 'Headphones', 'Vacuum Cleaner'"),
      serial_number: fieldSchema("string", "Serial number or IMEI if present on the document"),
      purchase_date: fieldSchema("string", "Purchase date in ISO 8601 format, yyyy-mm-dd"),
      purchase_price: fieldSchema("number", "Total amount paid, as a plain number with no currency symbol"),
      currency: fieldSchema("string", "ISO 4217 currency code, e.g. 'INR', 'USD'"),
      warranty_months: fieldSchema("number", "Warranty duration in months, if stated or standard for the product"),
      notes: fieldSchema("string", "Anything else worth flagging for human review, or null"),
    },
    required: [
      "product_name",
      "brand",
      "category",
      "serial_number",
      "purchase_date",
      "purchase_price",
      "currency",
      "warranty_months",
      "notes",
    ],
  },
}

function fieldSchema(valueType: "string" | "number", description: string) {
  return {
    type: "object" as const,
    description,
    properties: {
      value: { type: [valueType, "null"] as any, description },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
    },
    required: ["value", "confidence"],
  }
}

export async function extractInvoiceData(params: {
  base64: string
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf"
}): Promise<InvoiceExtraction> {
  // NOTE: the installed @anthropic-ai/sdk@0.32.1 declares MessageParam's
  // content union as TextBlockParam | ImageBlockParam | ToolUseBlockParam |
  // ToolResultBlockParam — it does not include a document/PDF block variant
  // in its TypeScript types, even though the Messages API itself accepts
  // `{ type: "document", source: { type: "base64", media_type:
  // "application/pdf", ... } }` at runtime. This was previously silently
  // masked by `ignoreBuildErrors: true` in next.config.mjs rather than
  // actually being type-sound.
  //
  // The correct long-term fix is bumping @anthropic-ai/sdk to a version
  // whose types include DocumentBlockParam (check the SDK's CHANGELOG for
  // when PDF support landed) and removing this cast entirely. Until then,
  // this narrow `as any` is scoped to exactly the one field the SDK's types
  // don't model, with the reason documented here, rather than disabling
  // type-checking for the whole build.
  const contentBlock =
    params.mediaType === "application/pdf"
      ? ({
          type: "document",
          source: { type: "base64", media_type: params.mediaType, data: params.base64 },
        } as any)
      : { type: "image" as const, source: { type: "base64" as const, media_type: params.mediaType, data: params.base64 } }

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    max_tokens: 1024,
    system:
      "You extract structured purchase data from invoices and receipts for a product-passport app. " +
      "Only report a field as 'high' confidence if it is stated explicitly and unambiguously on the document. " +
      "If a field cannot be determined, set value to null and confidence to 'low' rather than guessing. " +
      "Never invent a serial number, price, or date that does not appear on the document.",
    messages: [
      {
        role: "user",
        content: [
          contentBlock,
          { type: "text", text: "Extract the purchase details from this invoice using the record_invoice_extraction tool." },
        ],
      },
    ],
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "record_invoice_extraction" },
  })

  const toolUse = response.content.find((block) => block.type === "tool_use")
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Anthropic API did not return a structured extraction result")
  }

  return toolUse.input as InvoiceExtraction
}



// ----------------------------------------------------------------------------
// AI Diagnose — turns a filled-out condition survey (plus, for devices like
// laptops/phones, the pasted output of a real battery-check command) into a
// 0–100 AI Score and a buy-accessory / upgrade / repair / sell / recycle call.
// ----------------------------------------------------------------------------
const DIAGNOSTIC_TOOL = {
  name: "record_diagnostic_report",
  description:
    "Record the AI Score and lifecycle recommendation for a physical item based on its survey answers and device-check output.",
  input_schema: {
    type: "object" as const,
    properties: {
      ai_score: {
        type: "integer",
        description: "Overall condition/health score from 0 (dead/unusable) to 100 (like new).",
      },
      score_breakdown: {
        type: "object" as const,
        description: "Sub-scores 0-100. Use null for any axis that doesn't apply to this category.",
        properties: {
          battery: { type: ["integer", "null"] },
          performance: { type: ["integer", "null"] },
          cosmetic: { type: ["integer", "null"] },
          functionality: { type: ["integer", "null"] },
        },
        required: ["battery", "performance", "cosmetic", "functionality"],
      },
      condition_summary: {
        type: "string",
        description: "2-3 plain-language sentences summarizing the item's current real-world condition.",
      },
      key_findings: {
        type: "array",
        items: { type: "string" },
        description: "3-6 short bullet points, the specific evidence behind the score (cite the survey answers/command output).",
      },
      recommendation_action: {
        type: "string",
        enum: ["buy_accessory", "upgrade", "repair", "sell", "recycle", "keep_using"],
        description:
          "buy_accessory: item is fine, a specific accessory would help (case, charger, battery pack, etc). " +
          "upgrade: worth investing in a component/version upgrade. repair: a specific fault should be fixed. " +
          "sell: still has resale value, better to sell now than let it depreciate further. " +
          "recycle: end of useful/economic life. keep_using: no action needed right now.",
      },
      recommendation_title: {
        type: "string",
        description: "Short actionable headline, e.g. 'Replace the battery' or 'List it for resale now'.",
      },
      recommendation_detail: {
        type: "string",
        description: "1-3 sentences explaining the reasoning, referencing the item's age/price/condition where relevant.",
      },
      estimated_cost_min: {
        type: ["number", "null"],
        description: "Low end of the expected cost of the recommended action, in estimated_cost_currency. Null if not applicable (e.g. keep_using).",
      },
      estimated_cost_max: {
        type: ["number", "null"],
        description: "High end of the expected cost (or, for 'sell', the expected resale price range).",
      },
      estimated_cost_currency: { type: "string", description: "ISO 4217 currency code, e.g. 'INR', 'USD'." },
      urgency: { type: "string", enum: ["low", "medium", "high"] },
    },
    required: [
      "ai_score",
      "score_breakdown",
      "condition_summary",
      "key_findings",
      "recommendation_action",
      "recommendation_title",
      "recommendation_detail",
      "estimated_cost_min",
      "estimated_cost_max",
      "estimated_cost_currency",
      "urgency",
    ],
  },
}

export async function generateDiagnosticReport(params: {
  productName: string | null
  brand: string | null
  category: string
  purchaseDate: string | null
  purchasePrice: number | null
  currency: string
  ageMonths: number | null
  surveyAnswers: Record<string, string>
  deviceCheck: { os: string; command: string; output: string } | null
}): Promise<DiagnosticReport> {
  const lines = [
    `Product: ${params.productName || "Unknown"} (${params.brand || "Unknown brand"}, category: ${params.category})`,
    `Purchased: ${params.purchaseDate || "unknown date"}${params.ageMonths !== null ? ` (~${params.ageMonths} months ago)` : ""}`,
    `Original price: ${params.purchasePrice !== null ? `${params.purchasePrice} ${params.currency}` : "unknown"}`,
    "",
    "Survey answers:",
    ...Object.entries(params.surveyAnswers).map(([q, a]) => `- ${q}: ${a}`),
  ]

  if (params.deviceCheck) {
    lines.push(
      "",
      `Device-check command run by the user (${params.deviceCheck.os}):`,
      params.deviceCheck.command,
      "",
      "Raw output pasted by the user:",
      params.deviceCheck.output.slice(0, 4000),
    )
  }

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    max_tokens: 1200,
    system:
      "You are the AI Diagnose engine for a product-ownership app. Given a survey about a physical item's condition " +
      "(and, when available, real battery/device diagnostic output the user pasted from their own machine), you assess " +
      "its current real-world condition and produce an AI Score plus one clear next-step recommendation. " +
      "Ground every score and claim in the specific answers/output given — never invent readings the user did not report. " +
      "If the device-check output is missing, empty, or the user said they couldn't run it, score the battery axis from " +
      "the survey answers alone (or null it out if truly unknown) rather than guessing a number. " +
      "Weigh age and original price when estimating resale value or repair/upgrade cost — use realistic, current " +
      "market-appropriate figures for the given currency and be conservative rather than optimistic.",
    messages: [{ role: "user", content: lines.join("\n") }],
    tools: [DIAGNOSTIC_TOOL],
    tool_choice: { type: "tool", name: "record_diagnostic_report" },
  })

  const toolUse = response.content.find((block) => block.type === "tool_use")
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Anthropic API did not return a structured diagnostic report")
  }

  return toolUse.input as DiagnosticReport
}
