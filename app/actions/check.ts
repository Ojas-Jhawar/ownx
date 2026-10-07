"use server"

import { headers } from "next/headers"
import { createHash } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { VerificationStatus } from "@/lib/verification"

export type CheckResult = {
  found: boolean
  registered_device?: boolean
  verification?: VerificationStatus
  reported?: "lost" | "stolen" | null
  product_name?: string | null
  brand?: string | null
}
export type CheckState = { error: string | null; result?: CheckResult; query?: string }

const MAX_PER_HOUR = 20

export async function checkItem(_prev: CheckState, fd: FormData): Promise<CheckState> {
  const query = String(fd.get("query") || "").trim().slice(0, 64)
  if (query.length < 5) return { error: "Enter at least 5 characters of an Ownx ID, serial number or IMEI." }

  const h = await headers()
  const ip = (h.get("x-forwarded-for") || "unknown").split(",")[0].trim()
  const keyHash = createHash("sha256").update(ip + (process.env.WAITLIST_SALT || "ownx")).digest("hex").slice(0, 32)

  const admin = createAdminClient()
  const since = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await admin
    .from("public_rate_limit").select("id", { count: "exact", head: true })
    .eq("bucket", "check").eq("key_hash", keyHash).gte("created_at", since)
  if ((count ?? 0) >= MAX_PER_HOUR) return { error: "Too many checks from this network. Try again in an hour.", query }
  await admin.from("public_rate_limit").insert({ bucket: "check", key_hash: keyHash })

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("public_check_item", { p_query: query })
  if (error) return { error: "Could not run the check. Please try again.", query }
  return { error: null, result: data as CheckResult, query }
}
