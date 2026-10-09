import { redirect } from "next/navigation"
import { AppShell } from "@/components/app/app-shell"
import { createClient } from "@/lib/supabase/server"
import { updateScrapRate } from "@/app/actions/scrap-rates"
import { formatDate } from "@/lib/format"

const field = "w-24 rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-brand"

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: profile } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single()
  if (profile?.platform_role !== "admin") redirect("/dashboard")

  const { data } = await supabase.from("scrap_rates").select("*").order("category").order("kind").order("name")
  const rows = data || []
  const groups = rows.reduce<Record<string, typeof rows>>((acc, r) => ((acc[r.category] ||= []).push(r), acc), {})
  const oldest = rows.reduce<string | null>((o, r) => (!o || r.updated_at < o ? r.updated_at : o), null)
  const stale = oldest ? Date.now() - new Date(oldest).getTime() > 30 * 86_400_000 : false

  return (
    <AppShell active="Admin" userEmail={user.email}>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Scrap rates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the rates the public scrap calculator uses. Check them against a recycler quote at least monthly.
        </p>
        {stale && (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-ink">
            Some rates were last changed {formatDate(oldest)}. Review them.
          </p>
        )}
        {rows.length === 0 && <p className="mt-6 text-sm text-muted-foreground">No rows yet. Run migration 014.</p>}
        {Object.entries(groups).map(([cat, items]) => (
          <section key={cat} className="mt-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold capitalize text-ink">{cat}</h2>
            <div className="mt-3 divide-y divide-border">
              {items.map((r) => (
                <form key={r.id} action={updateScrapRate.bind(null, r.id)} className="flex flex-wrap items-center gap-2 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{r.name}</p>
                    <p className="text-xs text-muted-foreground">Updated {formatDate(r.updated_at)}</p>
                  </div>
                  {r.kind === "weight" ? (
                    <>
                      <label className="text-xs text-muted-foreground">Share<input name="pct_of_weight" type="number" step="0.01" defaultValue={r.pct_of_weight ?? ""} className={`${field} ml-1`} /></label>
                      <label className="text-xs text-muted-foreground">₹/kg<input name="rate_per_kg" type="number" step="0.5" defaultValue={r.rate_per_kg ?? ""} className={`${field} ml-1`} /></label>
                    </>
                  ) : (
                    <>
                      <label className="text-xs text-muted-foreground">Grams<input name="grams" type="number" step="0.001" defaultValue={r.grams ?? ""} className={`${field} ml-1`} /></label>
                      <label className="text-xs text-muted-foreground">₹/g<input name="rate_per_gram" type="number" step="1" defaultValue={r.rate_per_gram ?? ""} className={`${field} ml-1`} /></label>
                    </>
                  )}
                  <button type="submit" className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-muted">Save</button>
                </form>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  )
}
