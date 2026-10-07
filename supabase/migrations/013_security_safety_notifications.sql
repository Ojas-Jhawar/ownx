-- Migration 013: close public data leaks, lost/stolen reports, public item check, notifications.
-- Run after 012. Safe to re-run.

-- 0. Generic rate-limit table (service role only; no policies on purpose)
create table if not exists public.public_rate_limit (
  id bigserial primary key,
  bucket text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists public_rate_limit_idx on public.public_rate_limit (bucket, key_hash, created_at desc);
alter table public.public_rate_limit enable row level security;

-- 1. SECURITY: share links were enumerable. These four policies let ANY anonymous
--    REST caller list every active share slug, then read each asset (full serial,
--    price, owner id, extraction_raw) and its service history. Replace with RPCs
--    that return only what /share/[slug] displays, for one known slug.
drop policy if exists "Anyone can view active passport shares" on public.passport_shares;
drop policy if exists "Anyone can view assets behind an active share" on public.assets;
drop policy if exists "Anyone can view service records behind an active share" on public.service_records;
drop policy if exists "Anyone can view diagnoses behind an active share" on public.ai_diagnoses;

-- Verification for anonymous viewers. `devices` is authenticated-only under RLS, so
-- getAssetVerification() always returned "unverified" on public pages (bug).
create or replace function public.public_asset_verification(p_asset_id uuid)
returns text language sql security definer stable set search_path = public as $$
  select case
    when not (exists (select 1 from public.listings l where l.asset_id = p_asset_id and l.status = 'active')
           or exists (select 1 from public.passport_shares s where s.asset_id = p_asset_id and s.status = 'active'))
      then 'unverified'
    when d.id is null then 'unverified'
    when d.last_transfer_channel = 'owner_resale' then 'formerly_verified'
    else 'verified' end
  from (select 1) x left join public.devices d on d.asset_id = p_asset_id
  limit 1;
$$;
grant execute on function public.public_asset_verification(uuid) to anon, authenticated;

create or replace function public.get_shared_passport(p_slug text)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare v_share record;
begin
  select * into v_share from public.passport_shares where slug = p_slug and status = 'active';
  if not found then return null; end if;
  return jsonb_build_object(
    'asset', (select jsonb_build_object(
        'product_name', a.product_name, 'brand', a.brand, 'category', a.category,
        'image_url', a.image_url, 'condition_score', a.condition_score,
        'warranty_months', a.warranty_months, 'purchase_date', a.purchase_date,
        'serial_masked', case when a.serial_number is null or trim(a.serial_number) = '' then null
                              when length(trim(a.serial_number)) <= 6 then trim(a.serial_number)
                              else left(trim(a.serial_number), 2) || '••••' || right(trim(a.serial_number), 4) end)
      from public.assets a where a.id = v_share.asset_id),
    'owner_name', (select full_name from public.profiles where id = v_share.owner_id),
    'owner_count', 1 + (select count(*) from public.ownership_transfers t where t.asset_id = v_share.asset_id and t.status = 'accepted'),
    'verification', public.public_asset_verification(v_share.asset_id),
    'records', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'title', r.title, 'notes', r.notes, 'cost', r.cost,
        'performed_by', r.performed_by, 'serviced_at', r.serviced_at) order by r.serviced_at desc)
      from public.service_records r where r.asset_id = v_share.asset_id), '[]'::jsonb)
  );
end $$;
grant execute on function public.get_shared_passport(text) to anon, authenticated;

-- 2. Lost / stolen reports (roadmap 3.3). Keyed on asset so it works for self-reported items too.
create table if not exists public.lost_reports (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('lost', 'stolen')),
  details text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index if not exists lost_reports_one_open_idx on public.lost_reports (asset_id) where status = 'open';
alter table public.lost_reports enable row level security;

drop policy if exists "Owners view own reports" on public.lost_reports;
create policy "Owners view own reports" on public.lost_reports for select using (auth.uid() = owner_id);
drop policy if exists "Owners file reports for own assets" on public.lost_reports;
create policy "Owners file reports for own assets" on public.lost_reports for insert
  with check (auth.uid() = owner_id and exists (select 1 from public.assets a where a.id = asset_id and a.owner_id = auth.uid()));
drop policy if exists "Owners resolve own reports" on public.lost_reports;
create policy "Owners resolve own reports" on public.lost_reports for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- A flagged item cannot be handed to someone else.
create or replace function public.block_flagged_transfer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.lost_reports where asset_id = new.asset_id and status = 'open') then
    raise exception 'This item is reported lost or stolen and cannot be transferred. Resolve the report first.';
  end if;
  return new;
end $$;
drop trigger if exists ownership_transfers_block_flagged on public.ownership_transfers;
create trigger ownership_transfers_block_flagged before insert on public.ownership_transfers
  for each row execute procedure public.block_flagged_transfer();

-- 3. Public "Check an item": Ownx ID, serial or IMEI. No personal data returned.
create or replace function public.public_check_item(p_query text)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare q text := lower(trim(p_query)); v_ids uuid[]; v_dev record; v_kind text;
begin
  if length(q) < 5 then return jsonb_build_object('found', false); end if;
  select * into v_dev from public.devices
    where lower(ownx_id) = q or lower(trim(serial_number)) = q or lower(trim(imei)) = q limit 1;
  select array_agg(distinct a) into v_ids from (
    select asset_id as a from public.devices where lower(ownx_id) = q or lower(trim(serial_number)) = q or lower(trim(imei)) = q
    union all select id from public.assets where lower(trim(serial_number)) = q
  ) t where a is not null;
  select kind into v_kind from public.lost_reports
    where asset_id = any(coalesce(v_ids, '{}')) and status = 'open' order by created_at desc limit 1;
  return jsonb_build_object(
    'found', v_dev.id is not null or coalesce(array_length(v_ids, 1), 0) > 0,
    'registered_device', v_dev.id is not null,
    'verification', case when v_dev.id is null then 'unverified'
                         when v_dev.last_transfer_channel = 'owner_resale' then 'formerly_verified' else 'verified' end,
    'reported', v_kind,
    'product_name', v_dev.product_name,
    'brand', v_dev.brand);
end $$;
grant execute on function public.public_check_item(text) to anon, authenticated;

-- 4. Notifications
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_warranty boolean not null default true,
  email_transfers boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
drop policy if exists "Own prefs select" on public.notification_preferences;
create policy "Own prefs select" on public.notification_preferences for select using (auth.uid() = user_id);
drop policy if exists "Own prefs insert" on public.notification_preferences;
create policy "Own prefs insert" on public.notification_preferences for insert with check (auth.uid() = user_id);
drop policy if exists "Own prefs update" on public.notification_preferences;
create policy "Own prefs update" on public.notification_preferences for update using (auth.uid() = user_id);

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  unique (asset_id, kind)
);
alter table public.notification_log enable row level security; -- service role only
