# Ownx patch 2

## Apply
1. From the repo root: `python3 /path/to/ownx-patch/apply.py` (prints OK / SKIP / FAIL per edit, then `git diff`).
2. Run `supabase/migrations/014_blog_scrap_safety.sql` in Supabase (after 013).
3. Add `ADMIN_EMAIL` to your env (optional). `vercel.json` now has a weekly scrap-rates reminder cron.
4. `pnpm typecheck && pnpm test`.
5. Open `/admin/blog`: the 8 drafts are there. Check the facts, add a cover, publish.

## What it does
- **Fixes:** passport page (`openReport` undefined), dashboard layout, dark-mode CSS, transfers email match, 90 default score, "Sell it" wording, model id, `/p/[slug]` verification for anonymous viewers, nav/footer links, resale copy, stale `check_once/`, test and typecheck scripts, sitemap.
- **Safety:** lost/stolen items now also blocked from seller-network sales.
- **Scrap value:** its own page `/tools/scrap-value`, rates in the database with an admin editor (`/admin/scrap-rates`), low-to-high ranges, working/broken toggle, typical-weight presets, shareable link, passport prefill button, weekly stale-rates reminder.
- **Blog:** 8 draft posts, tags, category filter, RSS (`/blog/rss.xml`), cover upload, "Draft with AI" (admin only, daily cap, saves as draft).

## Not done (honest list)
- Scrap rates are NOT auto-fetched from a price feed. I did not invent an API. The cron reminds you to review them.
- Org application UI (`/apply` + admin review) still missing.
- assets/devices unification, notification bell, agent (Phase 3).
- Blog post page does not yet show tags.
- Facts in seeded posts (consumer helpline, EPR rules, EU DPP) must be re-checked before publishing.
