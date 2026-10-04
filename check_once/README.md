# Ownx — Verification, Scrap Value, Blog & Ads patch

This is reference code, not applied to a live repo — copy each file into your
project at the matching path, then follow "Wire-up" notes below each section.

## 1. Verified vs Unverified — you already have this, mostly for free

You don't need a new column. Look at your own schema:

- `devices` (migration 004) is the **manufacturer/seller-issued** record —
  created by a manufacturer (`createDevice`) or accepted from a seller
  (`accept_device_transfer`). A `devices` row with `asset_id` pointing at an
  `assets` row means that asset's history is backed by an org, not just the
  owner's word.
- A plain `assets` row with **no** linked `devices` row is something the
  owner typed in themselves (manual entry or AI-extracted from *their own*
  invoice) — real, but self-reported.

So: **Verified = asset has a linked `devices` row. Unverified = it doesn't.**
That's the whole rule. `components/verification/verification-badge.tsx`
below just renders that boolean; you only need to fetch
`devices.asset_id` alongside the asset wherever you already fetch it (your
`passport/[id]/page.tsx` already does this — `deviceRaw`).

Add the same one-line query + `<VerificationBadge>` to:
- `app/dashboard/page.tsx` (per asset card)
- `app/marketplace/page.tsx` (per listing card)
- `app/p/[slug]/page.tsx` and `app/share/[slug]/page.tsx` (public pages)

Pattern for the public pages (they're anonymous, so keep it cheap — one
extra `.select("id").eq("asset_id", ...)` query, or a join):

```ts
const { data: deviceLink } = await supabase
  .from("devices")
  .select("id")
  .eq("asset_id", listing.asset_id)
  .maybeSingle()
const verified = !!deviceLink
```

Then `<VerificationBadge verified={verified} />` next to the existing
"Verified Passport" pill. (Rename that pill to something like "Ownx
Passport" so it doesn't collide in meaning with the new badge — the pill
means "this page is a real Ownx record," the badge means "an org, not just
the owner, backs this record.")

## 2. Scrap value + buy-new/repair/resell advisor

Two small, deterministic (no AI call) tools:

- `lib/scrap-rates.ts` — per-category material/weight profile + ₹/kg rates.
  **You will want to tune these numbers** — scrap metal prices move; treat
  this file as config, not gospel. Consider pulling real rates from a
  supplier API later.
- `lib/scrap-value.ts` — turns (category, weight, condition, optional
  purchase price/date) into: scrap/recycle value, a rough 2nd-hand resale
  estimate, and a recommendation (`sell_2nd_hand` / `recycle_for_parts` /
  `keep_using`).
- `lib/repair-advisor.ts` — the more general "should I buy new / upgrade /
  repair / buy 2nd hand" heuristic, independent of any specific asset.
- `components/tools/scrap-calculator.tsx` + `app/tools/scrap-value/page.tsx`
  — public page, no login, manual inputs. If you're logged in and pass
  `?assetId=`, it can prefill from your own asset (wire that part up if you
  want it inside the passport page too — see comment in the component).
- `components/tools/buy-vs-repair.tsx` + `app/tools/buy-vs-repair/page.tsx`
  — public page, no login.

These are intentionally *not* AI calls — weight-based material math doesn't
need an LLM, and keeping it deterministic means it's instant and free to
run for anonymous visitors. If you want AI Diagnose's condition survey to
*feed into* this (e.g. show scrap value alongside a `recycle` recommendation
in `components/service/ai-diagnose.tsx`), pass `result.score_breakdown` into
`estimateResaleValue()` from `lib/scrap-value.ts` after diagnosis completes.

## 3. Public blog

- `supabase/migrations/005_blog.sql` — new `blog_posts` table. Public can
  read published posts (no login). Only accounts with
  `profiles.platform_role = 'admin'` can write — you already have that enum
  value from migration 004, just no one has it set. Set yourself as admin:
  `update profiles set platform_role = 'admin' where id = '<your-user-id>';`
- `app/actions/blog.ts` — create/update/delete, admin-gated.
- `app/blog/page.tsx` — public list, no login.
- `app/blog/[slug]/page.tsx` — public detail, no login.

No admin UI is included (keeps this patch small) — write posts via SQL or a
quick Supabase Studio table edit for now; say the word if you want an
`/admin/blog` form too.

### Nav links

Add the new public pages to `components/site-header.tsx`'s `NAV` array and
`components/site-footer.tsx`'s "Product" column so people can actually find
them without a URL:

```ts
{ label: "Blog", href: "/blog" },
{ label: "Scrap Value", href: "/tools/scrap-value" },
{ label: "Buy vs Repair", href: "/tools/buy-vs-repair" },
```

## 4. Ads — sidebar rail (desktop), bottom banner (mobile)

Principle: ads never sit inside the primary content column, never cover a
button, and are opt-in per page (marketing/blog/marketplace — **not** the
core passport/create/dashboard flows, since that's where you don't want to
lose trust or tap targets).

- `components/ads/ad-slot.tsx` — thin wrapper around an ad network script
  (stubbed for Google AdSense — swap the script src/data attrs for whatever
  network you sign up with). Renders nothing but a labelled placeholder box
  until you set `NEXT_PUBLIC_ADSENSE_CLIENT` / a slot id, so it never breaks
  your build before you have real ad units.
- `components/ads/page-with-ad-rail.tsx` — desktop-only (`xl:` breakpoint)
  two-column layout: your content + a sticky 300px right rail. Wrap a
  page's content in it; below `xl` it just renders children (no layout
  shift, no ad).
- `components/ads/mobile-ad-banner.tsx` — fixed, dismissible bottom strip
  for small screens, ~56px tall, closable, remembers dismissal for the
  session (not persisted forever — don't be annoying). Pass
  `aboveBottomNav` when used inside `AppShell` so it sits above the
  existing mobile nav instead of covering it.

### Wire-up examples

`app/blog/page.tsx` and `app/marketplace/page.tsx`:
```tsx
import { PageWithAdRail } from "@/components/ads/page-with-ad-rail"
// ...
<PageWithAdRail adSlot="blog-list">
  {/* existing page content */}
</PageWithAdRail>
```

Mobile banner — add once near the root of public pages you're OK showing it
on (e.g. `app/blog/page.tsx`, marketplace), not inside `create/`, `login/`,
or checkout-like flows:
```tsx
import { MobileAdBanner } from "@/components/ads/mobile-ad-banner"
// ...
<MobileAdBanner adSlot="mobile-sticky" />
```

If you also want it inside the logged-in app shell (`components/app/app-shell.tsx`),
add `<MobileAdBanner adSlot="app-mobile" aboveBottomNav />` right before the
closing `</div>` of the `lg:hidden` wrapper — it'll float above the bottom
nav instead of under it.

### Android

There's no separate "Android app" in this codebase — Ownx is a responsive
web app, so "Android" here just means small-viewport mobile browsers, which
`MobileAdBanner` already targets via `sm:hidden` / breakpoint classes. If you
later wrap this in a WebView/TWA for the Play Store, the same component
keeps working; you'd only swap `AdSense` for **AdMob** banner ads through a
native bridge, which is outside what a web bundle can do — flag that
separately if/when you build the native wrapper.
