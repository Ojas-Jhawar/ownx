"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { generateDiagnosticReport } from "@/lib/anthropic"
import type { Asset, DiagnosticReport } from "@/lib/types"

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return { supabase, user }
}

function monthsSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const start = new Date(dateStr)
  if (Number.isNaN(start.getTime())) return null
  const now = new Date()
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
}

const ACTION_LABEL: Record<DiagnosticReport["recommendation_action"], string> = {
  buy_accessory: "Buy an accessory",
  upgrade: "Upgrade",
  repair: "Repair",
  sell: "Sell",
  recycle: "Recycle",
  keep_using: "Keep using",
}

/**
 * Runs the AI Diagnose survey through the Anthropic API, saves the full
 * report to `ai_diagnoses`, updates the asset's live condition_score, and
 * files a summary entry into product (service) history so it shows up in
 * the passport's Service tab alongside every other event.
 */
export async function runAiDiagnosis(input: {
  assetId: string
  category: string
  surveyAnswers: Record<string, string>
  deviceCheck: { os: string; command: string; output: string } | null
}) {
  const { supabase, user } = await requireUser()

  const { data: assetRaw, error: assetError } = await supabase
    .from("assets")
    .select("*")
    .eq("id", input.assetId)
    .eq("owner_id", user.id)
    .single()
  if (assetError || !assetRaw) throw new Error("Asset not found")
  const asset = assetRaw as Asset

  const report = await generateDiagnosticReport({
    productName: asset.product_name,
    brand: asset.brand,
    category: input.category,
    purchaseDate: asset.purchase_date,
    purchasePrice: asset.purchase_price,
    currency: asset.currency,
    ageMonths: monthsSince(asset.purchase_date),
    surveyAnswers: input.surveyAnswers,
    deviceCheck: input.deviceCheck,
  })

  // File the diagnostic report itself.
  const { data: diagnosisRow, error: diagError } = await supabase
    .from("ai_diagnoses")
    .insert({
      asset_id: asset.id,
      owner_id: user.id,
      category: input.category,
      survey_answers: input.surveyAnswers,
      device_check: input.deviceCheck,
      ai_score: report.ai_score,
      score_breakdown: report.score_breakdown,
      condition_summary: report.condition_summary,
      key_findings: report.key_findings,
      recommendation_action: report.recommendation_action,
      recommendation_title: report.recommendation_title,
      recommendation_detail: report.recommendation_detail,
      estimated_cost_min: report.estimated_cost_min,
      estimated_cost_max: report.estimated_cost_max,
      estimated_cost_currency: report.estimated_cost_currency,
      urgency: report.urgency,
    })
    .select("*")
    .single()
  if (diagError) throw new Error(diagError.message)

  // Add it to product history (the same service_records timeline everything
  // else lives in), so it shows up on the passport without a separate view.
  const costRange =
    report.estimated_cost_min !== null && report.estimated_cost_max !== null
      ? `${report.estimated_cost_currency} ${report.estimated_cost_min}–${report.estimated_cost_max}`
      : null

  const notesParts = [
    `AI Score: ${report.ai_score}/100.`,
    report.condition_summary,
    `Recommendation: ${ACTION_LABEL[report.recommendation_action]} — ${report.recommendation_title}.`,
    report.recommendation_detail,
    costRange ? `Estimated cost: ${costRange}.` : null,
  ].filter(Boolean)

  const { data: serviceRow, error: serviceError } = await supabase
    .from("service_records")
    .insert({
      asset_id: asset.id,
      owner_id: user.id,
      title: `AI Diagnostic Report — Score ${report.ai_score}/100`,
      notes: notesParts.join(" "),
      performed_by: "AI Diagnose",
      cost: null,
      serviced_at: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single()
  if (serviceError) throw new Error(serviceError.message)

  await supabase.from("ai_diagnoses").update({ service_record_id: serviceRow.id }).eq("id", diagnosisRow.id)

  // Keep the asset's live condition score in sync with the latest real-time
  // AI Score so it's reflected everywhere the passport shows "Condition".
  await supabase.from("assets").update({ condition_score: report.ai_score }).eq("id", asset.id)

  revalidatePath(`/passport/${asset.id}`)
  revalidatePath("/service")
  revalidatePath("/dashboard")

  return { ...diagnosisRow, service_record_id: serviceRow.id } as typeof diagnosisRow
}
