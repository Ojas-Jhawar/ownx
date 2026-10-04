import type { SupabaseClient } from "@supabase/supabase-js"

export type VerificationStatus = "verified" | "formerly_verified" | "unverified"

const LABELS: Record<VerificationStatus, { label: string; detail: string }> = {
  verified: {
    label: "Verified",
    detail: "Registered directly by the manufacturer and never transferred outside the verified seller network.",
  },
  formerly_verified: {
    label: "Formerly Verified",
    detail:
      "Originally registered by a manufacturer, but ownership has since changed hands through a private, unverified transfer — Ownx can no longer vouch for the current holder.",
  },
  unverified: {
    label: "Self-Reported",
    detail: "Entered by the owner themselves (manual entry or their own invoice) — no manufacturer or seller has signed off on it.",
  },
}

export function verificationLabel(status: VerificationStatus) {
  return LABELS[status]
}

/**
 * Verified  = a `devices` row is linked to this asset AND its
 *             last_transfer_channel is still 'manufacturer' or 'seller' —
 *             i.e. it has only ever moved through the org-verified network.
 * Formerly verified = same device, but it has since been passed along
 *             through a plain owner-to-owner transfer (last_transfer_channel
 *             = 'owner_resale') — real device, unverifiable current custody.
 * Unverified = no linked `devices` row at all — a self-reported asset.
 */
export async function getAssetVerification(
  supabase: SupabaseClient,
  assetId: string,
): Promise<VerificationStatus> {
  const { data } = await supabase
    .from("devices")
    .select("last_transfer_channel")
    .eq("asset_id", assetId)
    .maybeSingle()

  if (!data) return "unverified"
  return data.last_transfer_channel === "owner_resale" ? "formerly_verified" : "verified"
}

/** Batch version for list pages (dashboard, marketplace) — one query instead of N. */
export async function getAssetVerificationMap(
  supabase: SupabaseClient,
  assetIds: string[],
): Promise<Map<string, VerificationStatus>> {
  const map = new Map<string, VerificationStatus>()
  if (assetIds.length === 0) return map

  const { data } = await supabase
    .from("devices")
    .select("asset_id, last_transfer_channel")
    .in("asset_id", assetIds)

  for (const row of data || []) {
    if (!row.asset_id) continue
    map.set(row.asset_id, row.last_transfer_channel === "owner_resale" ? "formerly_verified" : "verified")
  }
  return map
}
