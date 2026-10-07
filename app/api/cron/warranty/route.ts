import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail, esc } from "@/lib/email"
import { warrantyDaysLeft } from "@/lib/warranty"

export const dynamic = "force-dynamic"

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: assets } = await admin
    .from("assets")
    .select("id, owner_id, product_name, purchase_date, warranty_months")
    .eq("status", "active")
    .not("purchase_date", "is", null)
    .not("warranty_months", "is", null)

  const due = (assets || [])
    .map((a) => ({ a, days: warrantyDaysLeft(a.purchase_date, a.warranty_months) }))
    .filter((x): x is { a: (typeof x)["a"]; days: number } => x.days !== null && x.days >= 0 && x.days <= 30)
    .map((x) => ({ ...x, kind: x.days <= 7 ? "warranty_7" : "warranty_30" }))

  const ownerIds = Array.from(new Set(due.map((d) => d.a.owner_id)))
  const [{ data: profiles }, { data: prefs }] = ownerIds.length
    ? await Promise.all([
        admin.from("profiles").select("id, email, full_name").in("id", ownerIds),
        admin.from("notification_preferences").select("user_id, email_warranty").in("user_id", ownerIds),
      ])
    : [{ data: [] }, { data: [] }]
  const profileById = new Map((profiles || []).map((p) => [p.id, p]))
  const optedOut = new Set((prefs || []).filter((p) => p.email_warranty === false).map((p) => p.user_id))
  const site = process.env.NEXT_PUBLIC_SITE_URL || ""

  let sent = 0
  for (const { a, days, kind } of due) {
    const profile = profileById.get(a.owner_id)
    if (!profile?.email || optedOut.has(a.owner_id)) continue

    // The unique (asset_id, kind) index is the dedupe: second insert fails, we skip.
    const { error: logError } = await admin.from("notification_log").insert({ user_id: a.owner_id, asset_id: a.id, kind })
    if (logError) continue

    const name = a.product_name || "Your device"
    const ok = await sendEmail({
      to: profile.email,
      subject: `${name}: warranty ends in ${days} day${days === 1 ? "" : "s"}`,
      html: `<p>Hi ${esc(profile.full_name || "there")},</p>
<p>The warranty on <strong>${esc(name)}</strong> ends in ${days} day${days === 1 ? "" : "s"}.
If anything is wrong with it, get it checked before then.</p>
<p><a href="${site}/passport/${a.id}">Open the passport</a></p>`,
    })
    if (ok) sent++
    else await admin.from("notification_log").delete().eq("asset_id", a.id).eq("kind", kind) // retry next run
  }
  return NextResponse.json({ checked: assets?.length ?? 0, due: due.length, sent })
}
