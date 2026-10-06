# Ownx patch: Phase 1 + fixes

Copy files over the same paths in your repo. Then apply the small edits below by hand.
Run `supabase/migrations/012_phase1_foundation.sql` in Supabase BEFORE deploying.
Append `.env.example.append` to your `.env.example` (it is now tracked in git; `.gitignore` is replaced).
Also `git rm "app/actions/#transfers.ts#"` if it still exists.

## Small manual edits

### 1. app/globals.css: dark mode is broken (real bug)
Delete the whole `@media (prefers-color-scheme: dark) { :root:not(.light) { ... } }` block, and the `.dark { ... }` block.
They swap `--background` to near-black but `ink`, `brand-soft`, `brand-foreground` have no dark values,
so every `text-ink` heading becomes dark-on-dark for anyone with an OS dark theme. `layout.tsx` now locks `colorScheme: 'light'`.

### 2. app/resale/[id]/page.tsx: redirect while paused
```ts
import { RESALE_ENABLED } from "@/lib/features"
// first line inside Page():
if (!RESALE_ENABLED) redirect("/marketplace")
```

### 3. app/passport/[id]/page.tsx: hide the sell card
```tsx
import { RESALE_ENABLED } from "@/lib/features"
// change:   {!listing && (
// to:       {RESALE_ENABLED && !listing && (
```

### 4. Nav: hide Marketplace while paused
- `components/site-header.tsx`: `const NAV = [...].filter((i) => RESALE_ENABLED || i.href !== "/marketplace")`
  (the page itself still works as Coming soon; the footer link can stay).
- `components/app/app-shell.tsx`: remove `Marketplace` from `BASE_NAV` unless `RESALE_ENABLED`
  (this file is a client component, so use the same `NEXT_PUBLIC_` flag import).
- `components/site-footer.tsx`: change `{ label: "Privacy", href: "#" }` to `"/privacy"` and Terms to `"/terms"`.

### 5. app/transfers/page.tsx: wrong match on email (bug)
`.ilike("to_email", user.email || "")` treats `_` and `%` in an email as wildcards
(`a_b@x.com` also matches `axb@x.com`). RLS already limits rows to the recipient, so use an exact match:
```ts
.eq("to_email", (user.email || "").toLowerCase())
```
Also delete the unused import `acceptDeviceTransfer, declineDeviceTransfer` from that file.

### 6. Honest "verified" copy
- `app/p/[slug]/page.tsx` footer: `This is a verified listing powered by Ownx.`
  -> `{verification === "verified" ? "Registered by a manufacturer or approved seller." : "Entered by the owner. Ownx has not verified this item."}`
- `app/share/[slug]/page.tsx` footer: same idea, and drop "verified" from "a verified passport shared read-only".
- `components/service/ai-diagnose.tsx`: `sell: { label: "Sell it" ...}` -> `"Consider selling later"`.

### 7. app/create/review/page.tsx: no invented condition score
`defaultValue={asset.condition_score ?? 90}` -> `defaultValue={asset.condition_score}`
and label it `Condition score (0-100, your estimate)`.

### 8. lib/anthropic.ts
- Default model: `process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5"` (two places). Check the id against your Anthropic console.
- Bump `@anthropic-ai/sdk` to a current version, then delete the `as any` PDF cast.

### 9. package.json scripts
`"typecheck": "tsc --noEmit"`, `"lint": "next lint"`.

### 10. Marketing copy still pitching resale
`/features` ("Verified Resale"), `/how-it-works` ("From receipt to resale", step "Resell"),
`/about` vision lines, `components/home/lifecycle.tsx` ("Resell"). Rename to "Share" / "Transfer".

## What this patch does
- Marketplace "Coming soon" + waitlist (honeypot, per-IP limit, service-role insert), `createListing` blocked server-side
- Resale CTA on home replaced by passport sharing
- Migration 012: waitlist, missing org columns, `admin_create_organization` RPC (the action called it but no migration defined it), serial uniqueness relaxed on `assets`
- Layout metadata (removed `generator: v0.app`, added OG/Twitter, metadataBase), locked to light theme
- `error.tsx`, `loading.tsx`, `not-found.tsx`, `robots.ts`, `sitemap.ts`
- Privacy and Terms drafts (need legal review)
- `.gitignore` no longer hides `.env.example`; ignores tsbuildinfo and editor autosaves

## Still open (from your roadmap, not done here)
Markdown editor at /admin/blog, notifications/email, unifying assets vs devices, agent protocol spec, tests.
Also: `SQL_EDITOR_SETUP.sql` stops at 008; move to Supabase CLI migrations (roadmap 2.2).
