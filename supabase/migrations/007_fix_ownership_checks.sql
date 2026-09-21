-- ============================================================================
-- Migration 007 — Close RLS insert gaps
--
-- service_records, ai_diagnoses, listings, and passport_shares all had an
-- insert policy that checked `auth.uid() = owner_id` but never verified that
-- the referenced asset_id actually belongs to that user. Server actions
-- mostly compensated for this themselves, but addServiceRecord did not (see
-- app/actions/service.ts in this same patch) — so any logged-in user could
-- call that action with someone else's asset_id and RLS would happily let
-- the insert through, since owner_id on the new row was still their own id.
--
-- Combined with the public "Anyone can view service records behind an
-- active share" policy (which matches on asset_id only), this meant anyone
-- could inject a fake service-history line — or a fake, trashed AI Diagnose
-- score — onto another user's public shared passport.
--
-- Fix: every insert policy on a table that references assets.id must also
-- confirm the caller owns that asset, not just that they own the new row.
--
-- Safe to re-run: drop-then-create for every policy touched.
-- ============================================================================

drop policy if exists "Users can insert their own service records" on public.service_records;
create policy "Users can insert their own service records"
  on public.service_records for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.assets a
      where a.id = service_records.asset_id and a.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can insert their own diagnoses" on public.ai_diagnoses;
create policy "Users can insert their own diagnoses"
  on public.ai_diagnoses for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.assets a
      where a.id = ai_diagnoses.asset_id and a.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can insert their own listings" on public.listings;
create policy "Users can insert their own listings"
  on public.listings for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.assets a
      where a.id = listings.asset_id and a.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can insert their own passport shares" on public.passport_shares;
create policy "Users can insert their own passport shares"
  on public.passport_shares for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.assets a
      where a.id = passport_shares.asset_id and a.owner_id = auth.uid()
    )
  );
