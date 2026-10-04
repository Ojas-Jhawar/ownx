-- ============================================================================
-- Migration 011 — Critical fixes
--
-- Run this AFTER migration 010 (and after folding 009/010 in if you haven't
-- already — see supabase/SQL_EDITOR_SETUP.sql, which this patch does not
-- fully rewrite given its size; run 009, 010, then this file in order on top
-- of it instead).
--
-- Fixes five issues found in review:
--
-- 1. `devices` had an UPDATE policy ("Manufacturers can update their own
--    devices") with no column restriction. Postgres RLS can't express
--    "this column may change, that one may not" directly, so in practice
--    ANY column — including status, current_owner_id, asset_id and
--    last_transfer_channel — was writable by a device's manufacturer org.
--    A manufacturer could set last_transfer_channel back to 'manufacturer'
--    after a plain owner-to-owner resale to silently restore a "Verified"
--    badge the system had correctly downgraded, or reassign current_owner_id
--    outright. Fixed with a BEFORE UPDATE trigger that locks those five
--    "trust" columns unless a session flag is set — and only the
--    SECURITY DEFINER transfer/sale functions below set that flag.
--
-- 2. `lifecycle_events`'s insert policy let any verified seller/repair_shop
--    staff member insert a row with `actor_org_id` set to ANY organization's
--    id, not necessarily their own — it checked "the caller belongs to some
--    verified org of the right type" but never checked that
--    `lifecycle_events.actor_org_id` was actually that org. That meant one
--    repair shop could sign a "Verified" repair event credited to a
--    different (possibly more reputable) repair shop's name. Fixed by
--    requiring actor_org_id to match the membership row used to pass the
--    check.
--
-- 3. app/actions/devices.ts's recordSale() used to update devices.status
--    directly from the client's session — with no UPDATE policy granting a
--    seller org write access to a device it doesn't manufacture, that
--    update matched zero rows and failed silently, so a device's status
--    never actually flipped to 'sold' and the double-sell guard
--    (`status !== 'registered'`) never engaged. Added
--    `seller_mark_device_sold()`, a SECURITY DEFINER RPC that re-verifies
--    org membership itself.
--
-- 4. addRepairEvent() used to insert directly into `service_records` as the
--    repair shop's own session. service_records' insert policy requires
--    `auth.uid() = owner_id`, which a repair shop can never satisfy for
--    someone else's asset — so the insert was rejected by RLS every time,
--    silently, because the error was never checked. Added
--    `repair_add_service_record()`, a SECURITY DEFINER RPC that re-derives
--    the asset/owner from the device record and inserts on their behalf,
--    for this one verified, fully-audited path only.
--
-- 5. No duplicate-serial/IMEI detection anywhere, and no limit on how many
--    times a user can call the Anthropic-backed invoice extraction / AI
--    Diagnose actions. Added partial unique indexes and a small
--    `ai_usage_log` table + RPC for a simple per-user daily cap.
--
-- Safe to re-run: drop-then-create / create-or-replace throughout.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Lock devices' trust columns behind a trigger, not just RLS
-- ----------------------------------------------------------------------------
create or replace function public.protect_device_trust_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only the SECURITY DEFINER functions below set this, immediately before
  -- the specific update that's allowed to touch these columns, and it's
  -- transaction-local (set_config(..., true)) so it can never leak into an
  -- unrelated statement.
  if coalesce(current_setting('ownx.bypass_trust_lock', true), '') = 'on' then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.current_owner_id is distinct from old.current_owner_id
     or new.asset_id is distinct from old.asset_id
     or new.last_transfer_channel is distinct from old.last_transfer_channel
     or new.manufacturer_org_id is distinct from old.manufacturer_org_id
  then
    raise exception
      'status, current_owner_id, asset_id, last_transfer_channel and manufacturer_org_id can only change through an Ownx-verified transfer/sale function, not a direct update.';
  end if;

  return new;
end;
$$;

drop trigger if exists devices_protect_trust_columns on public.devices;
create trigger devices_protect_trust_columns
  before update on public.devices
  for each row execute procedure public.protect_device_trust_columns();

-- Re-create the three functions that legitimately need to change those
-- columns, adding the bypass flag immediately before each statement that
-- touches `devices`. (Re-created at their latest — migration 006 — shape.)

create or replace function public.accept_device_transfer(p_transfer_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_transfer record;
  v_device record;
  v_email text;
  v_new_asset_id uuid;
begin
  v_email := auth.jwt() ->> 'email';
  if v_email is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_transfer from public.device_transfers where id = p_transfer_id for update;
  if not found then
    raise exception 'Transfer not found';
  end if;
  if v_transfer.status <> 'pending' then
    raise exception 'This transfer is no longer pending';
  end if;
  if lower(v_transfer.to_email) <> lower(v_email) then
    raise exception 'This transfer was not sent to you';
  end if;

  select * into v_device from public.devices where id = v_transfer.device_id for update;
  if not found then
    raise exception 'Device not found';
  end if;

  perform set_config('ownx.bypass_trust_lock', 'on', true);

  if v_device.asset_id is null then
    insert into public.assets (
      owner_id, status, product_name, brand, category, image_url, serial_number,
      purchase_date, purchase_price, currency, warranty_months, extraction_source
    ) values (
      auth.uid(), 'active', v_device.product_name, v_device.brand, v_device.category, v_device.image_url,
      v_device.serial_number, current_date, v_transfer.sale_price, 'INR', v_device.warranty_months, 'manual'
    )
    returning id into v_new_asset_id;

    update public.devices set asset_id = v_new_asset_id where id = v_device.id;
  else
    update public.assets
      set owner_id = auth.uid(),
          purchase_price = coalesce(v_transfer.sale_price, purchase_price),
          purchase_date = current_date
      where id = v_device.asset_id;

    update public.listings set status = 'withdrawn' where asset_id = v_device.asset_id and status = 'active';
    update public.passport_shares set status = 'revoked' where asset_id = v_device.asset_id and status = 'active';
  end if;

  update public.device_transfers
    set status = 'accepted', to_user_id = auth.uid(), resolved_at = now()
    where id = p_transfer_id;

  update public.devices
    set current_owner_id = auth.uid(), status = 'active', last_transfer_channel = 'seller'
    where id = v_device.id;

  insert into public.lifecycle_events (device_id, event_type, status, actor_user_id, title, detail)
  values (v_device.id, 'ownership_transfer_accepted', 'confirmed', auth.uid(),
          'Ownership accepted', 'New owner accepted the passport transfer through a verified seller.');
end;
$$;

grant execute on function public.accept_device_transfer(uuid) to authenticated;

create or replace function public.accept_ownership_transfer(p_transfer_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_transfer record;
  v_email text;
begin
  v_email := auth.jwt() ->> 'email';
  if v_email is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_transfer from public.ownership_transfers where id = p_transfer_id for update;
  if not found then
    raise exception 'Transfer not found';
  end if;
  if v_transfer.status <> 'pending' then
    raise exception 'This transfer is no longer pending';
  end if;
  if lower(v_transfer.to_email) <> lower(v_email) then
    raise exception 'This transfer was not sent to you';
  end if;

  update public.ownership_transfers
    set status = 'accepted', to_user_id = auth.uid(), resolved_at = now()
    where id = p_transfer_id;

  update public.assets
    set owner_id = auth.uid()
    where id = v_transfer.asset_id;

  update public.listings
    set status = 'withdrawn'
    where asset_id = v_transfer.asset_id and status = 'active';

  update public.passport_shares
    set status = 'revoked'
    where asset_id = v_transfer.asset_id and status = 'active';

  perform set_config('ownx.bypass_trust_lock', 'on', true);

  update public.devices
    set current_owner_id = auth.uid(), last_transfer_channel = 'owner_resale'
    where asset_id = v_transfer.asset_id;

  insert into public.lifecycle_events (device_id, event_type, status, actor_user_id, title, detail)
  select id, 'ownership_transfer_accepted', 'documented', auth.uid(),
         'Ownership changed privately', 'Ownership transferred owner-to-owner, outside the verified seller network. Verification status downgraded.'
  from public.devices where asset_id = v_transfer.asset_id;
end;
$$;

-- NEW: used by app/actions/devices.ts's recordSale(). Direct client-side
-- update used to silently fail (see header note #3) — this re-verifies the
-- caller's own seller-org membership and the device's current status itself,
-- rather than trusting the caller to have already checked either.
create or replace function public.seller_mark_device_sold(p_device_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_authorized boolean;
  v_status text;
begin
  select exists (
    select 1
    from public.device_transfers t
    join public.organization_members m on m.organization_id = t.from_org_id
    join public.organizations o on o.id = t.from_org_id
    where t.device_id = p_device_id
      and t.status = 'pending'
      and m.user_id = auth.uid()
      and o.org_type = 'seller'
      and o.verified = true
  ) into v_authorized;

  if not v_authorized then
    raise exception 'No pending sale from a verified seller org you belong to was found for this device';
  end if;

  select status into v_status from public.devices where id = p_device_id for update;
  if v_status is null then
    raise exception 'Device not found';
  end if;
  if v_status <> 'registered' then
    raise exception 'This device already has an owner or a pending sale.';
  end if;

  perform set_config('ownx.bypass_trust_lock', 'on', true);
  update public.devices set status = 'sold' where id = p_device_id;
end;
$$;

grant execute on function public.seller_mark_device_sold(uuid) to authenticated;

-- NEW: used by app/actions/devices.ts's addRepairEvent() to mirror a signed
-- repair into the owner's Service tab (see header note #4). Re-derives the
-- asset/owner from the device row itself rather than trusting the caller's
-- claims about who owns what.
create or replace function public.repair_add_service_record(
  p_device_id uuid,
  p_title text,
  p_notes text,
  p_performed_by text,
  p_cost numeric
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_authorized boolean;
  v_device record;
  v_record_id uuid;
begin
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = auth.uid()
      and o.org_type = 'repair_shop'
      and o.verified = true
  ) into v_authorized;

  if not v_authorized then
    raise exception 'Only verified repair shop staff can log a service record this way';
  end if;

  select id, asset_id, current_owner_id into v_device from public.devices where id = p_device_id;
  if v_device.id is null then
    raise exception 'Device not found';
  end if;
  if v_device.asset_id is null or v_device.current_owner_id is null then
    raise exception 'This device is not yet linked to a claimed passport';
  end if;

  insert into public.service_records (asset_id, owner_id, title, notes, performed_by, cost, serviced_at)
  values (v_device.asset_id, v_device.current_owner_id, p_title, p_notes, p_performed_by, p_cost, current_date)
  returning id into v_record_id;

  return v_record_id;
end;
$$;

grant execute on function public.repair_add_service_record(uuid, text, text, text, numeric) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. lifecycle_events — stop org impersonation (actor_org_id wasn't checked
--    against the caller's actual membership)
-- ----------------------------------------------------------------------------
drop policy if exists "Authorized actors can add lifecycle events" on public.lifecycle_events;
create policy "Authorized actors can add lifecycle events"
  on public.lifecycle_events for insert to authenticated
  with check (
    (actor_user_id = auth.uid() and status = 'reported')
    or exists (
      select 1 from public.organization_members m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = auth.uid()
        and o.verified = true
        -- FIX: added — the caller's membership must be in the SAME org the
        -- event claims to be from, not just any verified org of a matching
        -- type.
        and m.organization_id = lifecycle_events.actor_org_id
        and (
          (o.org_type = 'manufacturer' and exists (
            select 1 from public.devices d where d.id = lifecycle_events.device_id and d.manufacturer_org_id = m.organization_id
          ))
          or o.org_type = 'repair_shop'
          or o.org_type = 'seller'
        )
    )
  );

-- ----------------------------------------------------------------------------
-- 3. Duplicate serial / IMEI detection
-- ----------------------------------------------------------------------------
-- NOTE: existing data may already contain duplicates (blank strings compare
-- equal to each other once lowercased/trimmed, and pre-launch test rows may
-- collide). Review `select lower(trim(serial_number)), count(*) from
-- public.devices where serial_number is not null and trim(serial_number) <>
-- '' group by 1 having count(*) > 1;` (and the equivalent for
-- public.assets) before running this section on a database with existing
-- rows, and resolve any hits first — CREATE UNIQUE INDEX will otherwise fail.
create unique index if not exists devices_serial_unique_idx
  on public.devices (lower(trim(serial_number)))
  where serial_number is not null and trim(serial_number) <> '';

create unique index if not exists devices_imei_unique_idx
  on public.devices (lower(trim(imei)))
  where imei is not null and trim(imei) <> '';

-- Self-reported assets are a softer signal than manufacturer-issued devices
-- (same serial legitimately re-typed with different spacing/case is common
-- user error, not necessarily fraud), so this is a unique index rather than
-- a hard app-level block — it still prevents exact duplicate passports.
create unique index if not exists assets_serial_unique_idx
  on public.assets (lower(trim(serial_number)))
  where serial_number is not null and trim(serial_number) <> '';

-- ----------------------------------------------------------------------------
-- 4. Basic per-user AI usage rate limiting
-- ----------------------------------------------------------------------------
create table if not exists public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_log_user_kind_idx on public.ai_usage_log (user_id, kind, created_at desc);

alter table public.ai_usage_log enable row level security;

-- No insert/select policy for `authenticated` on purpose: the RPC below is
-- SECURITY DEFINER and is the only way this table is read or written from
-- the app, so a user can't inspect or reset their own count from the client.
drop policy if exists "Admins can view AI usage" on public.ai_usage_log;
create policy "Admins can view AI usage"
  on public.ai_usage_log for select to authenticated
  using (public.is_admin());

-- Atomically checks whether the caller is under `p_limit` calls of `p_kind`
-- in the last 24 hours and, if so, logs this call and returns true;
-- otherwise returns false without logging anything. Called once per
-- Anthropic API call from app/actions/assets.ts and app/actions/diagnose.ts.
create or replace function public.check_and_increment_ai_usage(p_kind text, p_limit integer default 20)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select count(*) into v_count
  from public.ai_usage_log
  where user_id = auth.uid()
    and kind = p_kind
    and created_at > now() - interval '24 hours';

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.ai_usage_log (user_id, kind) values (auth.uid(), p_kind);
  return true;
end;
$$;

grant execute on function public.check_and_increment_ai_usage(text, integer) to authenticated;
