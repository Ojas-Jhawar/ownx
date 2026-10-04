-- ============================================================================
-- Migration 009 — Public asset-photos bucket
-- Cover photos for assets (shown on dashboard, passport, public listing and
-- share pages). Public read is intentional: /p/[slug] and /share/[slug] are
-- unauthenticated pages that need to render this image via next/image.
-- Writes are still scoped to the uploading user's own folder.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('asset-photos', 'asset-photos', true)
on conflict (id) do nothing;

drop policy if exists "Users can upload their own asset photos" on storage.objects;
create policy "Users can upload their own asset photos"
  on storage.objects for insert
  with check (
    bucket_id = 'asset-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can replace their own asset photos" on storage.objects;
create policy "Users can replace their own asset photos"
  on storage.objects for update
  using (
    bucket_id = 'asset-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own asset photos" on storage.objects;
create policy "Users can delete their own asset photos"
  on storage.objects for delete
  using (
    bucket_id = 'asset-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Anyone can view asset photos" on storage.objects;
create policy "Anyone can view asset photos"
  on storage.objects for select
  using (bucket_id = 'asset-photos');
