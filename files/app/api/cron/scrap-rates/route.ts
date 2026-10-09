import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email"

export const dynamic = "force-dynamic"

// Weekly. Does not guess market prices: it reminds an admin when rates go stale.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const admin = createAdminClient()
  const { data } = await admin.from("scrap_rates").select("updated_at").order("updated_at", { ascending: false }).limit(1)
  const latest = data?.[0]?.updated_at as string | undefined
  const ageDays = latest ? Math.floor((Date.now() - new Date(latest).getTime()) / 86_400_000) : null
  const stale = ageDays === null || ageDays > 30

  let emailed = false
  const to = process.env.ADMIN_EMAIL
  if (stale && to) {
    emailed = await sendEmail({
      to,
      subject: "Ownx: scrap rates need a review",
      html: `<p>Scrap rates were last edited ${ageDays === null ? "never" : `${ageDays} days ago`}.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin/scrap-rates">Review them</a></p>`,
    })
  }
  return NextResponse.json({ ageDays, stale, emailed })
}
