-- ============================================================================
-- Migration 008 — Security hardening
--
-- Fixes three issues found in review:
--
-- 1. `documents` had the same missing-ownership-check gap that migration 007
--    already fixed on service_records / ai_diagnoses / listings /
--    passport_shares: the insert policy checked `auth.uid() = owner_id` but
--    never checked that `asset_id` actually belongs to that user. Closed the
--    same way 007 did.
--
-- 2. `organizations.verified` defaulted to `true` on self-serve creation, so
--    any logged-in user could become a "manufacturer" and mint fake Ownx IDs,
--    or become a "seller"/"repair_shop" and sign fake sale/repair events that
--    the UI then displayed as "Verified". Flips the default to `false` and
--    adds an admin-only approval path. Existing orgs are grandfathered as
--    verified (see backfill at the bottom) — remove that line if you'd
--    rather re-review everyone.
--
-- 3. `devices` and `lifecycle_events` had `using (true)` select policies —
--    ANY authenticated user could read every row via the Supabase REST API
--    (not just the ones they look up by a known Ownx ID), exposing every
--    device's serial number/IMEI/authenticity notes system-wide. Replaced
--    with policies scoped to: the device's current owner, the manufacturer
--    org that registered it, orgs that have logged a lifecycle event on it,
--    and orgs with a pending device_transfers row for it. A SECURITY DEFINER
--    RPC (`lookup_device_by_ownx_id`) restores the legitimate "seller/repair
--    shop types in an exact Ownx ID" flow without reopening bulk read access,
--    and is restricted to verified seller/repair_shop members.
--
-- Safe to re-run: drop-then-create for every policy/function touched.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. documents insert policy — verify asset_id ownership, not just owner_id
-- ----------------------------------------------------------------------------
drop policy if exists "Users can insert their own documents" on public.documents;
create policy "Users can insert their own documents"
  on public.documents for insert
  with check (
    auth.uid() = owner_id
    and (
      asset_id is null
      or exists (
        select 1 from public.assets a
        where a.id = documents.asset_id and a.owner_id = auth.uid()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Organization verification gate
-- ----------------------------------------------------------------------------
alter table public.organizations alter column verified set default false;

-- Grandfather existing orgs so nothing you've already tested breaks. Delete
-- this line if you'd rather every org (including ones you made while
-- testing) go through approval from a clean slate.
update public.organizations set verified = true where verified is not true;

-- Only an admin (profiles.platform_role = 'admin') can flip verified.
drop policy if exists "Org owners can update their organization" on public.organizations;
create policy "Org owners can update their organization"
  on public.organizations for update to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organizations.id and m.user_id = auth.uid() and m.role = 'owner'
    )
  )
  with check (
    -- org owners can edit their own org's non-trust fields, but cannot set
    -- verified = true themselves (old value must be preserved unless an
    -- admin makes the change)
    verified = (select o.verified from public.organizations o where o.id = organizations.id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.platform_role = 'admin')
  );

drop policy if exists "Admins can approve organizations" on public.organizations;
create policy "Admins can approve organizations"
  on public.organizations for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.platform_role = 'admin'));

-- ----------------------------------------------------------------------------
-- 3a. devices — replace blanket select with scoped access
-- ----------------------------------------------------------------------------
drop policy if exists "Authenticated can view devices" on public.devices;
create policy "Owners and involved orgs can view devices"
  on public.devices for select to authenticated
  using (
    current_owner_id = auth.uid()
    or exists (
      select 1 from public.organization_members m
      where m.user_id = auth.uid() and m.organization_id = devices.manufacturer_org_id
    )
    or exists (
      select 1 from public.lifecycle_events e
      join public.organization_members m on m.organization_id = e.actor_org_id
      where e.device_id = devices.id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.device_transfers t
      where t.device_id = devices.id
        and (
          t.to_user_id = auth.uid()
          or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(t.to_email)
          or exists (select 1 from public.organization_members m where m.user_id = auth.uid() and m.organization_id = t.from_org_id)
        )
    )
  );

-- Manufacturers register devices; only verified manufacturers may do so.
drop policy if exists "Manufacturers can register devices" on public.devices;
create policy "Manufacturers can register devices"
  on public.devices for insert to authenticated
  with check (
    exists (
      select 1 from public.organization_members m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = auth.uid()
        and m.organization_id = devices.manufacturer_org_id
        and o.org_type = 'manufacturer'
        and o.verified = true
    )
  );

drop policy if exists "Manufacturers can update their own devices" on public.devices;
create policy "Manufacturers can update their own devices"
  on public.devices for update to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = auth.uid() and m.organization_id = devices.manufacturer_org_id and o.org_type = 'manufacturer'
    )
  );

-- A verified seller/repair_shop looking up an exact Ownx ID a customer gave
-- them is a legitimate flow that scoped SELECT above would otherwise block
-- (they have no prior relationship to the device yet). Restore it narrowly
-- through a SECURITY DEFINER function instead of reopening table-wide SELECT.
create or replace function public.lookup_device_by_ownx_id(p_ownx_id text)
returns public.devices
language plpgsql
security definer set search_path = public
as $$
declare
  v_device public.devices;
  v_authorized boolean;
begin
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = auth.uid()
      and o.org_type in ('seller', 'repair_shop')
      and o.verified = true
  ) into v_authorized;

  if not v_authorized then
    raise exception 'Only verified seller or repair shop staff can look up devices by Ownx ID';
  end if;

  select * into v_device from public.devices where ownx_id = upper(trim(p_ownx_id));
  return v_device;
end;
$$;

grant execute on function public.lookup_device_by_ownx_id(text) to authenticated;

-- Same idea, keyed by the device's internal id instead of its Ownx ID — used
-- by addRepairEvent(), which already has the device's id from the earlier
-- lookup step and shouldn't have to round-trip through the Ownx ID again.
create or replace function public.lookup_device_by_id(p_device_id uuid)
returns public.devices
language plpgsql
security definer set search_path = public
as $$
declare
  v_device public.devices;
  v_authorized boolean;
begin
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = auth.uid()
      and o.org_type in ('seller', 'repair_shop')
      and o.verified = true
  ) into v_authorized;

  if not v_authorized then
    raise exception 'Only verified seller or repair shop staff can look up devices';
  end if;

  select * into v_device from public.devices where id = p_device_id;
  return v_device;
end;
$$;

grant execute on function public.lookup_device_by_id(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3b. lifecycle_events — same problem, same fix shape
-- ----------------------------------------------------------------------------
drop policy if exists "Authenticated can view lifecycle events" on public.lifecycle_events;
create policy "Owners and involved orgs can view lifecycle events"
  on public.lifecycle_events for select to authenticated
  using (
    exists (
      select 1 from public.devices d
      where d.id = lifecycle_events.device_id and d.current_owner_id = auth.uid()
    )
    or exists (
      select 1 from public.organization_members m
      join public.devices d on d.manufacturer_org_id = m.organization_id
      where d.id = lifecycle_events.device_id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.organization_members m
      where m.organization_id = lifecycle_events.actor_org_id and m.user_id = auth.uid()
    )
    or actor_user_id = auth.uid()
  );

-- Insert policy already required org membership or self-authored 'reported'
-- notes; additionally require verified org status for org-authored events.
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
-- 3c. Require verified orgs for the actions that mint trust signals
-- ----------------------------------------------------------------------------
drop policy if exists "Sellers can record a sale" on public.device_transfers;
create policy "Sellers can record a sale"
  on public.device_transfers for insert to authenticated
  with check (
    exists (
      select 1 from public.organization_members m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = auth.uid()
        and m.organization_id = device_transfers.from_org_id
        and o.org_type = 'seller'
        and o.verified = true
    )
    and exists (
      select 1 from public.devices d
      where d.id = device_transfers.device_id and d.status = 'registered'
    )
  );
