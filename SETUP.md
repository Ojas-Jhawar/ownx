# Ownx.io — Setup Guide

This is now a real Next.js app: real auth, a real Postgres database, real file
storage, and real AI invoice extraction. Follow these steps in order.

## 1. Create a Supabase project

1. Go to https://supabase.com → New Project. Pick any name/region, save the
   database password somewhere.
2. Once it's ready: **Project Settings → API**. Copy:
   - `Project URL` → this is `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Run the database schema

1. In Supabase: **SQL Editor → New query**.
2. Paste the entire contents of `supabase/schema.sql` from this project and
   click **Run**.
3. This creates all tables (profiles, assets, documents, service_records,
   listings, passport_shares, ownership_transfers), row-level security
   policies, and a private `documents` storage bucket with its own access
   policies. You don't need to click around Storage manually — the SQL does
   it.

   **Already ran schema.sql before?** It's not safe to re-run the whole file
   (the original policies use plain `create policy`, which errors on a
   duplicate). Instead just run `supabase/migrations/002_transfer_share_service_history.sql`
   on its own — it's the same new tables/columns/policies added since, and is
   safe to re-run any time.

## 3. Get an Anthropic API key

1. Go to https://console.anthropic.com/settings/keys and create a key.
2. This powers the "Extract with AI" button on the upload page (real vision
   + structured extraction, not a mock). If you skip this, the app still
   works fully via "Enter details manually."

## 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...       # from step 1
NEXT_PUBLIC_SUPABASE_ANON_KEY=...  # from step 1
ANTHROPIC_API_KEY=...              # from step 3
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # update after deploying
```

`.env.local` is already in `.gitignore` — it will never be committed.

## 5. Install and run locally

```bash
pnpm install   # or npm install
pnpm dev       # or npm run dev
```

Open http://localhost:3000, sign up with a real email/password, and walk
through: onboarding → create → upload → (AI extraction or manual) → review
→ passport → resale → marketplace.

Note: Supabase Auth sends a confirmation email by default. For faster local
testing you can turn this off in **Supabase → Authentication → Providers →
Email → "Confirm email"** (toggle off), or just check the inbox of the email
you sign up with.

## 6. Push to GitHub, deploy on Vercel

GitHub only stores code — it won't give you a live URL by itself. Connect it
to Vercel so every push auto-deploys:

```bash
git init
git add .
git commit -m "Ownx real webapp"
git branch -M main
git remote add origin https://github.com/<you>/ownx.git
git push -u origin main
```

Then:
1. Go to https://vercel.com → **Add New → Project** → import your GitHub repo.
2. In **Environment Variables**, add the same four keys from `.env.local`
   (use your real deployed URL for `NEXT_PUBLIC_SITE_URL` once you know it,
   e.g. `https://ownx.vercel.app` — you may need to redeploy once after
   setting it correctly).
3. Deploy. From now on, edit on your desktop → `git push` → Vercel rebuilds
   automatically and gives you a live link to share with judges.

## What's real vs. what's still a stub

**Real:**
- Email/password auth (Supabase Auth), session-protected routes
- File upload to private cloud storage, scoped per user
- AI invoice extraction via the real Anthropic API with a strict schema and
  per-field confidence, or a manual-entry fallback — your choice every time
- Dashboard, passport, service history, and listings all read/write a real
  Postgres database
- Public shareable listing pages (`/p/[slug]`) work for anyone, logged in or
  not, once you generate a listing from an asset
- Public read-only passport share pages (`/share/[slug]`) — a "send this to
  anyone to view" link, separate from a for-sale listing, with revoke support
- Real ownership transfer: the current owner sends a request to a recipient's
  email from the passport's **Ownership** tab; the recipient accepts or
  declines from `/transfers`. Accepting actually reassigns the passport
  (`assets.owner_id`) via a security-definer Postgres function, and
  auto-withdraws any active listing/share under the old owner
- Service history entries can record who performed the work (`performed_by`)
  and an attached receipt/bill, reusing the same private document storage as
  invoices

**Intentionally not built yet** (call these out honestly if asked):
- Google/Apple OAuth login (Supabase supports it — needs you to register
  OAuth apps with Google/Apple and add the credentials in the Supabase
  dashboard; happy to wire it up once you have those)
- Password reset flow
- Editing the invoice image itself / re-running extraction on an existing
  asset
- Transfer notifications — the recipient has to check `/transfers`
  themselves; there's no email/push nudge yet (would need a transactional
  email provider wired into the accept/initiate actions)
- Marketplace ownership transfer on sale isn't linked to a purchase/payment
  flow yet — it's a manual "send to this email" action, which the person
  said they'd rather build out with the marketplace later
- The per-category diagnostic questionnaire (e.g. "run this command to check
  battery health") and the AI Condition Score that would consume its answers
  — next up
