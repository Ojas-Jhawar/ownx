# Ownx — Security & Correctness Fixes

This folder contains rectified files for the issues raised in the review.
Every file path mirrors its location in your repo, so you can diff/copy
each one directly over the original. Nothing here is a full repo — it's
**only the files that changed**, plus this guide and one new migration.

## How to apply this

1. **Back up / branch first.** `git checkout -b security-fixes` in your repo.
2. Copy each file from this zip into the matching path in your repo,
   overwriting the original. The tree here matches your repo's layout
   exactly (e.g. `app/actions/devices.ts` → your `app/actions/devices.ts`).
3. Run the new SQL migration (step-by-step below) **before** deploying the
   new code — the code assumes the RPC functions and RLS policies it adds
   already exist.
4. Delete `app/actions/#transfers.ts#` from your repo. It's an Emacs
   autosave file that got committed by accident — it's a stale duplicate of
   `app/actions/transfers.ts` missing the `lifecycle_events` logging the
   real file has, and its `#`-prefixed name means it isn't a routable
   module, but it still gets type-checked by `tsconfig.json`'s `**/*.ts`
   glob and adds confusion. There's nothing to copy from this zip for it —
   just `git rm "app/actions/#transfers.ts#"`.
5. `pnpm install && pnpm build` locally and fix anything that surfaces now
   that `ignoreBuildErrors` is off (see item 7 below — it should already be
   clean, but this is where a stray error would show up).
6. Test the checklist at the bottom before deploying.

---

## What changed, and why

### 1. Organizations are no longer auto-verified (the big one)

**Files:** `supabase/migrations/008_security_hardening.sql`,
`app/actions/organizations.ts`, `app/organization/page.tsx`

Previously, `createOrganization` inserted a row with `verified` defaulting
to `true` — any logged-in user could become a "manufacturer," instantly
mint Ownx IDs, then accept their own alt account's "sale" of that device,
and the marketplace/resale pages would render it as **Verified**. Same
issue for a self-serve "repair_shop" signing fake `confirmed` repair
events on someone else's device.

Now:
- `organizations.verified` defaults to `false`.
- Only an account with `profiles.platform_role = 'admin'` can flip it to
  `true` (new RLS policy + `approveOrganization()` action).
- `createDevice`, `recordSale`, and `addRepairEvent` all check
  `organizations.verified` before doing anything, both in the server
  action (for a clear error message) and at the RLS layer (so the check
  can't be bypassed by calling Supabase directly).
- The `/organization`, `/manufacturer` dashboards now show a "Pending
  verification" banner instead of silently letting an unverified org act.

**You need to do one manual thing after running the migration:** decide who
your admin is and run:
```sql
update public.profiles set platform_role = 'admin' where id = '<your-user-id>';
```
There's no UI for this yet — it's a deliberate, deliberately-manual gate.
The migration includes a line that grandfathers every *existing* org as
verified so nothing you already tested breaks; delete that line in the SQL
file before running it if you'd rather re-review everyone from scratch.

### 2. `documents` had the same RLS gap migration 007 already found elsewhere

**File:** `supabase/migrations/008_security_hardening.sql`

Migration 007 fixed `service_records`, `ai_diagnoses`, `listings`, and
`passport_shares` insert policies, which checked `owner_id = auth.uid()`
but never checked that the referenced `asset_id` actually belonged to that
user. `documents` had the identical gap and was missed. Fixed the same way.

### 3. `devices` / `lifecycle_events` no longer grant blanket read access

**Files:** `supabase/migrations/008_security_hardening.sql`,
`app/actions/devices.ts`, `app/manufacturer/page.tsx`

Both tables previously had `using (true)` SELECT policies — meaning any
logged-in user could hit Supabase's auto-generated REST API and dump
**every** device's serial number, IMEI, and authenticity notes, not just
ones they have a reason to see. The app's own UI never needed this (nobody
browses all devices — `lookupDeviceByOwnxId` always searches by an exact ID
someone typed in), so it was pure unnecessary exposure.

Replaced with policies scoped to: the device's current owner, the
manufacturer org that registered it, any org that's logged a lifecycle
event against it, and orgs with a pending transfer for it.

The one place the app legitimately needs to look up a device it has *no*
prior relationship to yet — a seller/repair shop typing in a customer's
exact Ownx ID — is restored through two new `SECURITY DEFINER` RPCs,
`lookup_device_by_ownx_id(text)` and `lookup_device_by_id(uuid)`, each of
which independently re-checks the caller belongs to a **verified**
seller/repair_shop org before returning anything. `app/actions/devices.ts`
now calls these instead of a direct `.from("devices").select(...)`.

### 4. Server-side guards against double-selling / bypassing the UI

**File:** `app/actions/devices.ts`

`recordSale` previously trusted the client to only submit when
`device.status === "registered"` (the UI hides the form otherwise, but
never re-checked on the server). A replayed or direct call could still
double-sell an already-claimed device. Added a server-side status check,
and a matching `check` in the new `device_transfers` insert RLS policy so
it's enforced even if some other client ever calls this differently.

### 5. Passport share links use a real secret, not a guessable slug

**Files:** `lib/utils.ts`, `app/actions/shares.ts`

`passport_shares.slug` gates read access to an asset's verified details and
full service history to "anyone who has the link." It was generated with
the same `randomSlug()` used for public, meant-to-be-found listing slugs —
a ~5-character `Math.random()` suffix, roughly 25 bits of entropy. Fine for
a listing; too weak for something acting as a bearer capability token.

Added `randomShareToken()` (backed by `crypto.randomUUID()`, ~122 bits) and
switched `createOrGetPassportShare` to use it. Existing share links already
issued keep working — this only changes what's generated going forward.

### 6. Real type errors that `ignoreBuildErrors: true` was hiding

**Files:** `next.config.mjs`, `lib/anthropic.ts`, `app/actions/profile.ts`

Two genuine type errors were being silently swallowed:

- `lib/anthropic.ts`: the installed `@anthropic-ai/sdk@0.32.1`'s
  `MessageParam.content` union doesn't include a document/PDF block type,
  even though the Messages API accepts one at runtime. Added a narrow,
  commented `as any` scoped to exactly that one value, with a note to
  remove it once you bump the SDK to a version whose types include
  `DocumentBlockParam`.
- `app/actions/profile.ts`: `updateProfile`'s return type was inferred
  rather than declared, and didn't consistently match the discriminated
  union `useActionState` expects in `settings-form.tsx`. Gave it an
  explicit `ProfileState` type that every return statement actually
  satisfies.

`next.config.mjs` now has `ignoreBuildErrors: false`, so `next build` will
fail loudly on the next real type error instead of shipping it silently.

### 7. Nav / footer pointed at superseded URLs

**Files:** `components/site-header.tsx`, `components/site-footer.tsx`

`/tools/buy-vs-repair` and `/tools/scrap-value` are now just `redirect()`
stubs to `/tools/device-advisor` (kept so old bookmarks/shares still work).
The footer still linked both under different labels, sending visitors
through a pointless double redirect and listing the same destination
twice. Footer now links the canonical URL once. The device advisor tool
and the blog were previously reachable *only* from the footer (below the
fold) — added both to the primary header nav so they're discoverable on
first screen. (Header breakpoint bumped from `md:`/`lg:` to `xl:` since
there are now more nav items than fit comfortably at `md`.)

---

## Order of operations (don't skip this)

1. Run `supabase/migrations/008_security_hardening.sql` in Supabase SQL
   Editor **first**.
2. Set your admin: `update public.profiles set platform_role = 'admin' where id = '<uuid>';`
3. Deploy the code changes.
4. If you want a clean re-review instead of grandfathering, also run:
   `update public.organizations set verified = false;`
   (only after step 2, so you can still approve them back through the app).

## Testing checklist

- [ ] A brand-new org (`createOrganization`) shows "Pending verification"
      on `/organization` and `/manufacturer`, and `createDevice` /
      `recordSale` / `addRepairEvent` all fail with a clear message until
      approved.
- [ ] After `update organizations set verified = true where id = ...` (or
      building an admin approval button using `approveOrganization()`),
      the same org can register a device / record a sale / sign a repair.
- [ ] `lookupDeviceByOwnxId` still works for a verified seller/repair_shop
      account, and fails for an unverified one or a plain owner account.
- [ ] Try `select * from devices` as a random authenticated user via the
      Supabase client directly (not through the app) — should return
      nothing unless that user owns/registered/services one of the rows.
- [ ] `recordSale` on a device that's already `sold`/`active` fails with
      "This device already has an owner or a pending sale," even if you
      call the server action directly instead of through the UI.
- [ ] New passport share links are long, opaque tokens (not short readable
      slugs); old links already issued still resolve.
- [ ] `pnpm build` succeeds with `ignoreBuildErrors: false`.
- [ ] Header/footer nav on desktop and mobile show Blog and Device Advisor
      and both routes still load.

## Not included in this patch (flagged in the original review, needs a
product decision before code)

- Unifying the three different "what's this worth" numbers (resale
  default of 60% purchase price, `lib/scrap-value.ts`'s depreciation
  curve, and AI Diagnose's LLM-generated `sell` estimate) — this is a
  product/UX call about which number is authoritative, not a bug fix.
- Formally merging or documenting the sync contract between the two
  ownership systems (`assets.owner_id` / `ownership_transfers` vs.
  `devices.current_owner_id` / `device_transfers`) — deeper refactor,
  flagged for a separate pass.
- An actual admin UI for approving organizations — `approveOrganization()`
  exists as a callable action, but there's no `/admin/organizations` page
  yet. Wire a simple table + button to it whenever you're ready; the
  server-side authorization is already there.
