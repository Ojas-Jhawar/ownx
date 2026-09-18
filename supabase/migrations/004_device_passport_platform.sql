-- ============================================================================
-- Migration 004 — Device Passport Platform
-- Adds organizations, devices (permanent Ownx IDs), an append-only lifecycle
-- ledger, and manufacturer/seller-initiated ownership transfers. Reuses the
-- existing assets/ownership_transfers/service_records tables wherever an
-- owner is already involved — this migration only adds what's genuinely new.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ORGANIZATIONS — manufacturers, sellers/retailers, repair shops
-- ----------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_type text not null check (org_type in ('manufacturer', 'seller', 'repair_shop', 'admin')),
  verified boolean not null default true, -- auto-verified for this demo; production would gate on Ownx admin review
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

drop policy if exists "Authenticated can view organizations" on public.organizations;
create policy "Authenticated can view organizations"
  on public.organizations for select to authenticated using (true);

drop policy if exists "Authenticated can create organizations" on public.organizations;
create policy "Authenticated can create organizations"
  on public.organizations for insert to authenticated with check (true);

drop policy if exists "Org owners can update their organization" on public.organizations;
create policy "Org owners can update their organization"
  on public.organizations for update to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = organizations.id and m.user_id = auth.uid() and m.role = 'owner'
  ));

-- ----------------------------------------------------------------------------
-- ORGANIZATION MEMBERS
-- ----------------------------------------------------------------------------
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

alter table public.organization_members enable row level security;

drop policy if exists "Users can view their own memberships" on public.organization_members;
create policy "Users can view their own memberships"
  on public.organization_members for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can join an organization as themselves" on public.organization_members;
create policy "Users can join an organization as themselves"
  on public.organization_members for insert to authenticated
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- PROFILES — convenience field for dashboard routing (not a security boundary;
-- actual authorization always goes through organization_members).
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists platform_role text not null default 'owner'
  check (platform_role in ('owner', 'manufacturer', 'seller', 'repair_shop', 'admin'));

-- ----------------------------------------------------------------------------
-- DEVICES — the permanent, manufacturer-issued passport record
-- ----------------------------------------------------------------------------
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  ownx_id text not null unique,
  manufacturer_org_id uuid references public.organizations (id) on delete set null,

  product_name text not null,
  brand text,
  category text,
  model_number text,
  serial_number text,
  imei text,
  manufactured_at date,
  warranty_months integer,
  authenticity_notes text,
  image_url text,

  status text not null default 'registered' check (status in ('registered', 'sold', 'active', 'archived')),
  current_owner_id uuid references auth.users (id) on delete set null,
  asset_id uuid references public.assets (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists devices_ownx_id_idx on public.devices (ownx_id);
create index if not exists devices_manufacturer_org_idx on public.devices (manufacturer_org_id);
create index if not exists devices_current_owner_idx on public.devices (current_owner_id);
create index if not exists devices_asset_id_idx on public.devices (asset_id);

drop trigger if exists devices_set_updated_at on public.devices;
create trigger devices_set_updated_at
  before update on public.devices
  for each row execute procedure public.set_updated_at();

alter table public.devices enable row level security;

drop policy if exists "Authenticated can view devices" on public.devices;
create policy "Authenticated can view devices"
  on public.devices for select to authenticated using (true);

drop policy if exists "Manufacturers can register devices" on public.devices;
create policy "Manufacturers can register devices"
  on public.devices for insert to authenticated
  with check (
    exists (
      select 1 from public.organization_members m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = auth.uid() and m.organization_id = devices.manufacturer_org_id and o.org_type = 'manufacturer'
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

-- ----------------------------------------------------------------------------
-- LIFECYCLE EVENTS — append-only audit trail. No update/delete policy exists
-- on purpose: history can never be silently rewritten.
-- ----------------------------------------------------------------------------
create table if not exists public.lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  event_type text not null check (event_type in (
    'manufactured', 'sale_recorded', 'ownership_transfer_initiated', 'ownership_transfer_accepted',
    'repair', 'accessory_added', 'document_added', 'condition_update', 'note', 'verification'
  )),
  status text not null default 'reported' check (status in ('reported', 'documented', 'verified', 'confirmed')),
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_org_id uuid references public.organizations (id) on delete set null,
  title text not null,
  detail text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lifecycle_events_device_id_idx on public.lifecycle_events (device_id, created_at desc);

alter table public.lifecycle_events enable row level security;

drop policy if exists "Authenticated can view lifecycle events" on public.lifecycle_events;
create policy "Authenticated can view lifecycle events"
  on public.lifecycle_events for select to authenticated using (true);

drop policy if exists "Authorized actors can add lifecycle events" on public.lifecycle_events;
create policy "Authorized actors can add lifecycle events"
  on public.lifecycle_events for insert to authenticated
  with check (
    -- an owner may add their own low-trust "reported" notes about their device
    (actor_user_id = auth.uid() and status = 'reported')
    or
    -- a manufacturer/seller/repair_shop staff member acting through their org
    exists (
      select 1 from public.organization_members m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = auth.uid()
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
-- DEVICE TRANSFERS — manufacturer/seller-network sale of a registered device
-- to its first (or next) buyer. Owner-to-owner resale keeps using the
-- existing ownership_transfers table further down.
-- ----------------------------------------------------------------------------
create table if not exists public.device_transfers (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  from_org_id uuid references public.organizations (id) on delete set null,
  to_email text not null,
  to_user_id uuid references auth.users (id) on delete set null,
  sale_price numeric(12, 2),
  invoice_document_id uuid references public.documents (id) on delete set null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists device_transfers_device_id_idx on public.device_transfers (device_id);
create index if not exists device_transfers_to_email_idx on public.device_transfers (lower(to_email));

alter table public.device_transfers enable row level security;

drop policy if exists "View device transfers I'm party to" on public.device_transfers;
create policy "View device transfers I'm party to"
  on public.device_transfers for select to authenticated
  using (
    to_user_id = auth.uid()
    or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(to_email)
    or exists (select 1 from public.organization_members m where m.user_id = auth.uid() and m.organization_id = from_org_id)
  );

drop policy if exists "Sellers can record a sale" on public.device_transfers;
create policy "Sellers can record a sale"
  on public.device_transfers for insert to authenticated
  with check (
    exists (
      select 1 from public.organization_members m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = auth.uid() and m.organization_id = device_transfers.from_org_id and o.org_type = 'seller'
    )
  );

drop policy if exists "Sellers can cancel their pending sale" on public.device_transfers;
create policy "Sellers can cancel their pending sale"
  on public.device_transfers for update to authenticated
  using (
    status = 'pending'
    and exists (select 1 from public.organization_members m where m.user_id = auth.uid() and m.organization_id = from_org_id)
  )
  with check (status = 'cancelled');

-- The only path that assigns a device's first/next owner and links (or
-- reassigns) the linked `assets` row. Runs as security definer, does its own
-- authorization check against the transfer's to_email.
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
    set current_owner_id = auth.uid(), status = 'active'
    where id = v_device.id;

  insert into public.lifecycle_events (device_id, event_type, status, actor_user_id, title, detail)
  values (v_device.id, 'ownership_transfer_accepted', 'confirmed', auth.uid(),
          'Ownership accepted', 'New owner accepted the passport transfer.');
end;
$$;

grant execute on function public.accept_device_transfer(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Sync existing owner-to-owner resale into the device ledger too, so a
-- device that's already been claimed keeps its lifecycle in sync when the
-- OWNER (not a seller) transfers it again — no new UI needed for this path,
-- it's the same "Transfer to someone" button already on the passport page.
-- ----------------------------------------------------------------------------
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

  -- NEW: keep a linked device's canonical record in sync + log it in the ledger
  update public.devices set current_owner_id = auth.uid() where asset_id = v_transfer.asset_id;

  insert into public.lifecycle_events (device_id, event_type, status, actor_user_id, title, detail)
  select id, 'ownership_transfer_accepted', 'confirmed', auth.uid(),
         'Ownership accepted', 'Ownership transferred to a new owner.'
  from public.devices where asset_id = v_transfer.asset_id;
end;
$$;
