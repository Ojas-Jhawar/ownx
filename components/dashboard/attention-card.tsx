import Link from "next/link"
import { AlertTriangle, ArrowRight } from "lucide-react"
import { warrantyDaysLeft } from "@/lib/warranty"
import type { Asset } from "@/lib/types"

// Server component. Drop it above "Your Assets" on app/dashboard/page.tsx.
export function AttentionCard({ assets }: { assets: Asset[] }) {
  const items = assets
    .map((a) => ({ a, days: warrantyDaysLeft(a.purchase_date, a.warranty_months) }))
    .filter((x) => x.days !== null && x.days >= 0 && x.days <= 30)
    .sort((x, y) => x.days! - y.days!)
  if (items.length === 0) return null

  return (
    <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-ink">Warranty ending soon</h2>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map(({ a, days }) => (
          <li key={a.id}>
            <Link href={`/passport/${a.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 text-sm hover:bg-muted">
              <span className="truncate font-medium text-ink">{a.product_name || "Untitled asset"}</span>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground">
                {days === 0 ? "ends today" : `${days} day${days === 1 ? "" : "s"} left`} <ArrowRight className="size-3.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
