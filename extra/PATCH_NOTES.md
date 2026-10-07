# Ownx patch: security, safety, notifications, blog admin

Copy the files over your repo at the same paths. Order matters.

## 1. Install and configure
```bash
pnpm add react-markdown remark-gfm rehype-sanitize
pnpm add -D vitest
pnpm up @anthropic-ai/sdk@latest        # then delete the `as any` PDF cast in lib/anthropic.ts
```
package.json scripts: `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`.

Add to `.env.example` / Vercel env: `RESEND_API_KEY=`, `EMAIL_FROM=Ownx <hello@yourdomain>`, `CRON_SECRET=<long random>`.

Run `supabase/migrations/013_security_safety_notifications.sql` in Supabase BEFORE deploying the new share page.

## 2. What I found in the repo (and fixed here)
| Severity | Finding | Fix |
|---|---|---|
| High | Share links were enumerable. Policies "Anyone can view active passport shares / assets behind an active share / service records behind an active share" let an anonymous REST call list every share slug, then read each asset's full serial, price, owner id and `extraction_raw`. | Migration 013 drops them; `/share/[slug]` now calls `get_shared_passport()`, which returns a masked serial and only the fields shown on the page. |
| Medium | Public pages always showed "Self-Reported". `getAssetVerification` queries `devices`, which is authenticated-only under RLS, so anonymous viewers never saw Verified. | `public_asset_verification()` RPC (see 4d for `/p/[slug]`). |
| Medium | `/p/[slug]` listing policy still exposes full `serial_number` to anon. Resale is paused so it is low risk now. | Convert to an RPC like the share one before re-enabling resale. |
| Low | `check_once/` is stale reference code (old verification boolean, old tool names). | `git rm -r check_once`. |

## 3. New features
- **Public "Check an item"** (`/check`): Ownx ID, serial or IMEI. Shows lost/stolen flag and verification, never owner data. Rate-limited per IP hash.
- **Lost/stolen reports**: `ReportLostCard` on the passport. Filing revokes share links, withdraws listings, cancels pending transfers; a DB trigger blocks any new transfer while a report is open.
- **Warranty emails**: `/api/cron/warranty` (daily 04:00 UTC via `vercel.json`) sends a 30-day and a 7-day notice, deduplicated by `notification_log`, honours `notification_preferences`.
- **Dashboard "Warranty ending soon"** card.
- **Blog admin** `/admin/blog`: Markdown with live preview, publish/draft, sanitized renderer, per-post metadata, Open Graph, Article JSON-LD, reading time, CTA.
- **Tests** (`pnpm test`) for warranty, repair advisor, scrap value, masking, Ownx ID.
- **`docs/agent-protocol.md`**: pairing, signing, report schema, trust tiers (roadmap action 10).

## 4. Wire-up edits (small, by hand)

a) `app/passport/[id]/page.tsx`: fetch and mount the report card.
```tsx
import { ReportLostCard } from "@/components/passport/report-lost-card"
// add to the Promise.all list or after it:
const { data: openReport } = await supabase.from("lost_reports").select("id, kind").eq("asset_id", id).eq("status", "open").maybeSingle()
// after <PassportTabs ... />:
<ReportLostCard assetId={asset.id} openReport={openReport} />
```

b) `app/dashboard/page.tsx`: above the "Your Assets" heading.
```tsx
import { AttentionCard } from "@/components/dashboard/attention-card"
{filter !== "warranty" && <AttentionCard assets={assets} />}
```

c) `app/actions/transfers.ts`: email the recipient after the insert succeeds.
```ts
import { sendEmail, esc } from "@/lib/email"
// after `if (error) throw new Error(error.message)`:
await sendEmail({
  to: toEmail,
  subject: "Someone sent you an Ownx passport",
  html: `<p>${esc(user.email || "An Ownx user")} sent you a passport.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/transfers">Review the transfer</a></p>`,
})
```

d) `lib/verification.ts`: add, and use it in `app/p/[slug]/page.tsx` instead of `getAssetVerification`.
```ts
export async function getPublicAssetVerification(supabase: SupabaseClient, assetId: string): Promise<VerificationStatus> {
  const { data } = await supabase.rpc("public_asset_verification", { p_asset_id: assetId })
  return (data as VerificationStatus) || "unverified"
}
```

e) Navigation and sitemap.
- `components/site-header.tsx` NAV: `{ label: "Check an Item", href: "/check" }`; also footer Product column.
- `app/sitemap.ts` staticPaths: add `"/check"`.
- `components/app/app-shell.tsx`: add a "Blog" link next to `ADMIN_ITEM` (`/admin/blog`).

## 5. Leftovers from `extra/CHANGES.md` that are still not applied in the files you sent
1. **`app/globals.css`**: delete the `.dark { }` block and the whole `@media (prefers-color-scheme: dark)` block (dark text on dark background for OS-dark users).
2. **`app/transfers/page.tsx`**: `.ilike("to_email", user.email || "")` -> `.eq("to_email", (user.email || "").toLowerCase())`; remove the unused `acceptDeviceTransfer, declineDeviceTransfer` import.
3. **`app/create/review/page.tsx`**: `asset.condition_score ?? 90` -> `asset.condition_score`; label "Condition score (0-100, your estimate)".
4. **`components/service/ai-diagnose.tsx`**: `sell` label "Sell it" -> "Consider selling later".
5. **`lib/anthropic.ts`** (two places): `"claude-sonnet-5"` -> `"claude-sonnet-5-5"`, and set the same in `.env.example`.
6. **Nav/footer**: filter Marketplace out of `site-header` NAV and `app-shell` BASE_NAV unless `RESALE_ENABLED`; footer Privacy -> `/privacy`, Terms -> `/terms`.
7. **Copy**: `/features` ("Verified Resale"), `/how-it-works` ("From receipt to resale"), `/about`, `components/home/lifecycle.tsx` ("Resell") -> "Share" / "Transfer".
8. **Migrations**: `SQL_EDITOR_SETUP.sql` still stops at 008. Move to the CLI: `supabase init && supabase link --project-ref <ref> && supabase db pull`, then commit `supabase/migrations/` and delete the SQL editor file.

## 6. Next after this patch (roadmap order)
Unify `assets` and `devices` (needs a written migration and rollback plan first), notification bell, `/admin/blog` cover upload and tags, then the agent (`docs/agent-protocol.md` is the contract).
