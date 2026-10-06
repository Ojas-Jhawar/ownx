"use server"

import { headers } from "next/headers"
import { createHash } from "crypto"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"

export type WaitlistState = { error: string | null; ok?: boolean }

const Schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  source: z.enum(["marketplace", "newsletter"]).default("marketplace"),
})

const MAX_PER_IP_PER_HOUR = 5

export async function joinWaitlist(_prev: WaitlistState, fd: FormData): Promise<WaitlistState> {
  // Honeypot: real users never see or fill this field.
  if (fd.get("company_website")) return { error: null, ok: true }

  const parsed = Schema.safeParse({ email: fd.get("email"), source: fd.get("source") || "marketplace" })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { email, source } = parsed.data

  const h = await headers()
  const ip = (h.get("x-forwarded-for") || "unknown").split(",")[0].trim()
  const ipHash = createHash("sha256").update(ip + (process.env.WAITLIST_SALT || "ownx")).digest("hex").slice(0, 32)

  const admin = createAdminClient()

  const since = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await admin
    .from("waitlist")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since)
  if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) {
    return { error: "Too many sign-ups from this network. Try again in an hour." }
  }

  const { error } = await admin.from("waitlist").insert({ email, source, ip_hash: ipHash })
  // 23505 = unique violation: already on the list. Treat as success, don't leak membership.
  if (error && error.code !== "23505") return { error: "Could not join the waitlist. Please try again." }

  return { error: null, ok: true }
}
