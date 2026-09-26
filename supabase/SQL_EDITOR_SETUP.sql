-- ============================================================================
-- Ownx.io — Supabase SQL Editor setup (CORRECTED, through migration 008)
--
-- Run THIS ONE FILE in Supabase -> SQL Editor -> New query.
-- It is designed to be safe to re-run after a partial/failed attempt.
--
-- Fixes included:
--   1. Creates public.listings before the assets policy that references it.
--   2. Creates organization_members before the organization-owner policy that
--      references it.
--   3. Includes all migrations in dependency order (002 through 008).
--      Migration 002 is not duplicated because its contents are already in
--      the base schema.
--   4. Uses DROP POLICY IF EXISTS before policy recreation where needed.
--   5. (This revision) Previously stopped at migration 006 — a fresh install
--      from that version left organizations.verified defaulting to `true`
--      (self-serve fake "Verified" manufacturers/sellers/repair shops),
--      documents' insert policy not checking asset_id ownership, and
--      devices/lifecycle_events world-readable to any authenticated user.
--      Migrations 007 and 008 are now folded in below to close those gaps,
--      matching what app/actions/devices.ts and app/actions/organizations.ts
--      already assume exists (the lookup_device_by_ownx_id /
--      lookup_device_by_id RPCs, the verified-org gates, etc).
-- ============================================================================

-- Extension needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- PROFILES
-- One row per auth.users row. Created automatically by a trigger on signup.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  avatar_initials text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    upper(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.email), 2))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- ASSETS
-- The core object. One row = one Ownership Passport.
-- ----------------------------------------------------------------------------
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,

  -- status: draft (mid-creation, not yet confirmed) -> active (confirmed passport)
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),

  product_name text,
  brand text,
  category text,
  image_url text,

  serial_number text,
  purchase_date date,
  purchase_price numeric(12, 2),
  currency text not null default 'INR',
  warranty_months integer,

  condition_score integer check (condition_score between 0 and 100),
  condition_notes text,

  -- raw extraction result from the Anthropic API, kept for audit/debugging
  extraction_source text check (extraction_source in ('ai', 'manual', null)),
  extraction_raw jsonb,
  extraction_confidence jsonb,

  invoice_document_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assets_owner_id_idx on public.assets (owner_id);
create index if not exists assets_status_idx on public.assets (status);

alter table public.assets enable row level security;

drop policy if exists "Users can view their own assets" on public.assets;
create policy "Users can view their own assets"
  on public.assets for select
  using (auth.uid() = owner_id);

drop policy if exists "Users can insert their own assets" on public.assets;
create policy "Users can insert their own assets"
  on public.assets for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can update their own assets" on public.assets;
create policy "Users can update their own assets"
  on public.assets for update
  using (auth.uid() = owner_id);

drop policy if exists "Users can delete their own assets" on public.assets;
create policy "Users can delete their own assets"
  on public.assets for delete
  using (auth.uid() = owner_id);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at
  before update on public.assets
  for each row execute procedure public.set_updated_at();

-- ----------------------------------------------------------------------------
-- DOCUMENTS
-- Files attached to an asset (invoice, warranty card, service bill, etc).
-- The actual bytes live in Supabase Storage; this table is the index.
-- ----------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'invoice' check (kind in ('invoice', 'warranty', 'service_bill', 'other')),
  storage_path text not null,
  file_name text,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists documents_asset_id_idx on public.documents (asset_id);

alter table public.documents enable row level security;

drop policy if exists "Users can view their own documents" on public.documents;
create policy "Users can view their own documents"
  on public.documents for select
  using (auth.uid() = owner_id);

-- NOTE: this insert policy is superseded further down by migration 008's
-- version, which also checks asset_id ownership. Left here (matching the
-- original schema.sql) only so early sections of this file stay internally
-- consistent before 008 tightens it — the final, effective policy is the
-- one created in the "Migration 008" section below.
drop policy if exists "Users can insert their own documents" on public.documents;
create policy "Users can insert their own documents"
  on public.documents for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can delete their own documents" on public.documents;
create policy "Users can delete their own documents"
  on public.documents for delete
  using (auth.uid() = owner_id);

-- ----------------------------------------------------------------------------
-- SERVICE HISTORY
-- ----------------------------------------------------------------------------
create table if not exists public.service_records (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  notes text,
  cost numeric(12, 2),
  serviced_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists service_records_asset_id_idx on public.service_records (asset_id);

alter table public.service_records enable row level security;

drop policy if exists "Users can view their own service records" on public.service_records;
create policy "Users can view their own service records"
  on public.service_records for select
  using (auth.uid() = owner_id);

-- Superseded by migration 007's version below (adds the asset_id ownership
-- check). Left here only for the same "internally consistent early on"
-- reason as documents, above.
drop policy if exists "Users can insert their own service records" on public.service_records;
create policy "Users can insert their own service records"
  on public.service_records for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can delete their own service records" on public.service_records;
create policy "Users can delete their own service records"
  on public.service_records for delete
  using (auth.uid() = owner_id);

-- ----------------------------------------------------------------------------
-- LISTINGS
-- Publicly viewable resale listings generated from an asset's passport.
-- ----------------------------------------------------------------------------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique,
  asking_price numeric(12, 2),
  status text not null default 'active' check (status in ('active', 'sold', 'withdrawn')),
  created_at timestamptz not null default now()
);

alter table public.listings enable row level security;

-- Owners manage their own listings
drop policy if exists "Users can view their own listings" on public.listings;
create policy "Users can view their own listings"
  on public.listings for select
  using (auth.uid() = owner_id);

-- Superseded by migration 007's version below.
drop policy if exists "Users can insert their own listings" on public.listings;
create policy "Users can insert their own listings"
  on public.listings for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can update their own listings" on public.listings;
create policy "Users can update their own listings"
  on public.listings for update
  using (auth.uid() = owner_id);

-- Anyone (including anonymous visitors) can view an ACTIVE listing by slug.
-- This is what makes /p/[slug] work as a public shareable page.
drop policy if exists "Anyone can view active listings" on public.listings;
create policy "Anyone can view active listings"
  on public.listings for select
  using (status = 'active');

-- Lets the public /p/[slug] listing page read just enough asset data to
-- render, without exposing any asset that isn't attached to an active listing.
drop policy if exists "Anyone can view assets behind an active listing" on public.assets;
create policy "Anyone can view assets behind an active listing"
  on public.assets for select
  using (
    exists (
      select 1 from public.listings l
      where l.asset_id = assets.id and l.status = 'active'
    )
  );

-- ----------------------------------------------------------------------------
-- STORAGE
-- Create a bucket named "documents" (Project -> Storage -> New bucket).
-- Set it to PRIVATE. These policies let each user read/write only their
-- own folder, keyed by their user id as the first path segment, e.g.
-- documents/<user_id>/<asset_draft_id>/invoice.pdf
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload to their own folder" on storage.objects;
create policy "Users can upload to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can view their own files" on storage.objects;
create policy "Users can view their own files"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own files" on storage.objects;
create policy "Users can delete their own files"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- Migration 002 — Ownership transfer, passport sharing, richer service history
-- ============================================================================

alter table public.service_records
  add column if not exists performed_by text,
  add column if not exists receipt_document_id uuid references public.documents (id) on delete set null;

create table if not exists public.passport_shares (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now()
);

create index if not exists passport_shares_asset_id_idx on public.passport_shares (asset_id);

alter table public.passport_shares enable row level security;

drop policy if exists "Users can view their own passport shares" on public.passport_shares;
create policy "Users can view their own passport shares"
  on public.passport_shares for select
  using (auth.uid() = owner_id);

-- Superseded by migration 007's version below.
drop policy if exists "Users can insert their own passport shares" on public.passport_shares;
create policy "Users can insert their own passport shares"
  on public.passport_shares for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can update their own passport shares" on public.passport_shares;
create policy "Users can update their own passport shares"
  on public.passport_shares for update
  using (auth.uid() = owner_id);

drop policy if exists "Anyone can view active passport shares" on public.passport_shares;
create policy "Anyone can view active passport shares"
  on public.passport_shares for select
  using (status = 'active');

drop policy if exists "Anyone can view assets behind an active share" on public.assets;
create policy "Anyone can view assets behind an active share"
  on public.assets for select
  using (
    exists (
      select 1 from public.passport_shares s
      where s.asset_id = assets.id and s.status = 'active'
    )
  );

drop policy if exists "Anyone can view service records behind an active share" on public.service_records;
create policy "Anyone can view service records behind an active share"
  on public.service_records for select
  using (
    exists (
      select 1 from public.passport_shares s
      where s.asset_id = service_records.asset_id and s.status = 'active'
    )
  );

create table if not exists public.ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_email text not null,
  to_user_id uuid references auth.users (id) on delete set null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists ownership_transfers_asset_id_idx on public.ownership_transfers (asset_id);
create index if not exists ownership_transfers_to_email_idx on public.ownership_transfers (lower(to_email));

alter table public.ownership_transfers enable row level security;

drop policy if exists "Sender can view own transfers" on public.ownership_transfers;
create policy "Sender can view own transfers"
  on public.ownership_transfers for select
  using (auth.uid() = from_user_id);

drop policy if exists "Recipient can view transfers addressed to them" on public.ownership_transfers;
create policy "Recipient can view transfers addressed to them"
  on public.ownership_transfers for select
  using (
    auth.uid() = to_user_id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(to_email)
  );

drop policy if exists "Sender can create a transfer for their own asset" on public.ownership_transfers;
create policy "Sender can create a transfer for their own asset"
  on public.ownership_transfers for insert
  with check (
    auth.uid() = from_user_id
    and exists (select 1 from public.assets a where a.id = asset_id and a.owner_id = auth.uid())
  );

drop policy if exists "Sender can cancel own pending transfer" on public.ownership_transfers;
create policy "Sender can cancel own pending transfer"
  on public.ownership_transfers for update
  using (auth.uid() = from_user_id and status = 'pending')
  with check (auth.uid() = from_user_id and status = 'cancelled');

drop policy if exists "Recipient can decline their pending transfer" on public.ownership_transfers;
create policy "Recipient can decline their pending transfer"
  on public.ownership_transfers for update
  using (status = 'pending' and lower(coalesce(auth.jwt() ->> 'email', '')) = lower(to_email))
  with check (status = 'declined');

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
end;
$$;

grant execute on function public.accept_ownership_transfer(uuid) to authenticated;

drop policy if exists "Recipient can view asset behind a pending transfer to them" on public.assets;
create policy "Recipient can view asset behind a pending transfer to them"
  on public.assets for select
  using (
    exists (
      select 1 from public.ownership_transfers t
      where t.asset_id = assets.id
        and t.status = 'pending'
        and lower(coalesce(auth.jwt() ->> 'email', '')) = lower(t.to_email)
    )
  );

-- ============================================================================
-- Migration 003 — AI Diagnose
-- ============================================================================

create table if not exists public.ai_diagnoses (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,

  category text not null,
  survey_answers jsonb not null default '{}'::jsonb,
  device_check jsonb,

  ai_score integer not null check (ai_score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  condition_summary text not null,
  key_findings jsonb not null default '[]'::jsonb,

  recommendation_action text not null check (
    recommendation_action in ('buy_accessory', 'upgrade', 'repair', 'sell', 'recycle', 'keep_using')
  ),
  recommendation_title text not null,
  recommendation_detail text not null,
  estimated_cost_min numeric(12, 2),
  estimated_cost_max numeric(12, 2),
  estimated_cost_currency text not null default 'INR',
  urgency text not null default 'low' check (urgency in ('low', 'medium', 'high')),

  service_record_id uuid references public.service_records (id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists ai_diagnoses_asset_id_idx on public.ai_diagnoses (asset_id);
create index if not exists ai_diagnoses_owner_id_idx on public.ai_diagnoses (owner_id);

alter table public.ai_diagnoses enable row level security;

drop policy if exists "Users can view their own diagnoses" on public.ai_diagnoses;
create policy "Users can view their own diagnoses"
  on public.ai_diagnoses for select
  using (auth.uid() = owner_id);

-- Superseded by migration 007's version below.
drop policy if exists "Users can insert their own diagnoses" on public.ai_diagnoses;
create policy "Users can insert their own diagnoses"
  on public.ai_diagnoses for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can delete their own diagnoses" on public.ai_diagnoses;
create policy "Users can delete their own diagnoses"
  on public.ai_diagnoses for delete
  using (auth.uid() = owner_id);

drop policy if exists "Anyone can view diagnoses behind an active share" on public.ai_diagnoses;
create policy "Anyone can view diagnoses behind an active share"
  on public.ai_diagnoses for select
  using (
    exists (
      select 1 from public.passport_shares s
      where s.asset_id = ai_diagnoses.asset_id and s.status = 'active'
    )
  );

-- ============================================================================
-- Migration 004 — Device Passport Platform
-- ============================================================================

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_type text not null check (org_type in ('manufacturer', 'seller', 'repair_shop', 'admin')),
  verified boolean not null default true, -- flipped to default false by migration 008 below
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

drop policy if exists "Authenticated can view organizations" on public.organizations;
create policy "Authenticated can view organizations"
  on public.organizations for select to authenticated using (true);

drop policy if exists "Authenticated can create organizations" on public.organizations;
create policy "Authenticated can create organizations"
  on public.organizations for insert to authenticated with check (true);

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

-- Superseded by migration 008's version below.
drop policy if exists "Org owners can update their organization" on public.organizations;
create policy "Org owners can update their organization"
  on public.organizations for update to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = organizations.id and m.user_id = auth.uid() and m.role = 'owner'
  ));

alter table public.profiles
  add column if not exists platform_role text not null default 'owner'
  check (platform_role in ('owner', 'manufacturer', 'seller', 'repair_shop', 'admin'));

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

-- NOTE: superseded by migration 008's scoped version below — that migration
-- drops this "using (true)" policy and replaces it. It's created here first
-- only so the table is usable at every intermediate step of this file.
drop policy if exists "Authenticated can view devices" on public.devices;
create policy "Authenticated can view devices"
  on public.devices for select to authenticated using (true);

-- Superseded by migration 008's version below (adds org.verified check).
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

-- NOTE: superseded by migration 008's scoped version below.
drop policy if exists "Authenticated can view lifecycle events" on public.lifecycle_events;
create policy "Authenticated can view lifecycle events"
  on public.lifecycle_events for select to authenticated using (true);

-- Superseded by migration 008's version below (adds org.verified check).
drop policy if exists "Authorized actors can add lifecycle events" on public.lifecycle_events;
create policy "Authorized actors can add lifecycle events"
  on public.lifecycle_events for insert to authenticated
  with check (
    (actor_user_id = auth.uid() and status = 'reported')
    or
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

-- Superseded by migration 008's version below (adds org.verified + device
-- status = 'registered' checks).
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

  update public.devices set current_owner_id = auth.uid() where asset_id = v_transfer.asset_id;

  insert into public.lifecycle_events (device_id, event_type, status, actor_user_id, title, detail)
  select id, 'ownership_transfer_accepted', 'confirmed', auth.uid(),
         'Ownership accepted', 'Ownership transferred to a new owner.'
  from public.devices where asset_id = v_transfer.asset_id;
end;
$$;

-- ============================================================================
-- Migration 005 — Public blog
-- ============================================================================

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users (id) on delete set null,

  slug text not null unique,
  title text not null,
  excerpt text,
  cover_image_url text,
  content text not null,
  category text not null default 'guide' check (category in ('guide', 'maintenance', 'sustainability', 'news')),

  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_status_idx on public.blog_posts (status, published_at desc);
create index if not exists blog_posts_slug_idx on public.blog_posts (slug);

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute procedure public.set_updated_at();

alter table public.blog_posts enable row level security;

drop policy if exists "Anyone can view published posts" on public.blog_posts;
create policy "Anyone can view published posts"
  on public.blog_posts for select
  using (status = 'published');

drop policy if exists "Admins can view all posts" on public.blog_posts;
create policy "Admins can view all posts"
  on public.blog_posts for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.platform_role = 'admin'));

drop policy if exists "Admins can write posts" on public.blog_posts;
create policy "Admins can write posts"
  on public.blog_posts for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.platform_role = 'admin'));

drop policy if exists "Admins can update posts" on public.blog_posts;
create policy "Admins can update posts"
  on public.blog_posts for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.platform_role = 'admin'));

drop policy if exists "Admins can delete posts" on public.blog_posts;
create policy "Admins can delete posts"
  on public.blog_posts for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.platform_role = 'admin'));

-- ============================================================================
-- Migration 006 — Verification channel
-- ============================================================================

alter table public.devices
  add column if not exists last_transfer_channel text not null default 'manufacturer'
  check (last_transfer_channel in ('manufacturer', 'seller', 'owner_resale'));

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

  update public.devices
    set current_owner_id = auth.uid(), last_transfer_channel = 'owner_resale'
    where asset_id = v_transfer.asset_id;

  insert into public.lifecycle_events (device_id, event_type, status, actor_user_id, title, detail)
  select id, 'ownership_transfer_accepted', 'documented', auth.uid(),
         'Ownership changed privately', 'Ownership transferred owner-to-owner, outside the verified seller network. Verification status downgraded.'
  from public.devices where asset_id = v_transfer.asset_id;
end;
$$;

-- ============================================================================
-- Migration 007 — Close RLS insert gaps
--
-- service_records, ai_diagnoses, listings, and passport_shares all had an
-- insert policy that checked `auth.uid() = owner_id` but never verified the
-- referenced asset_id actually belongs to that user. Fixed below: every
-- insert policy on a table that references assets.id now also confirms the
-- caller owns that asset, not just that they own the new row.
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

-- ============================================================================
-- Migration 008 — Security hardening
--
-- 1. documents insert policy gets the same asset_id-ownership check as 007.
-- 2. organizations.verified now defaults to false; only an admin
--    (profiles.platform_role = 'admin') can flip it to true. Existing orgs
--    are grandfathered as verified below — delete that UPDATE if you'd
--    rather re-review everyone from a clean slate.
-- 3. devices / lifecycle_events lose their "using (true)" blanket SELECT and
--    get scoped policies instead. Two SECURITY DEFINER RPCs
--    (lookup_device_by_ownx_id, lookup_device_by_id) restore the legitimate
--    "verified seller/repair shop types in an exact Ownx ID" lookup flow
--    without reopening bulk read access.
-- ============================================================================

-- 1. documents insert policy — verify asset_id ownership, not just owner_id
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

-- 2. Organization verification gate
alter table public.organizations alter column verified set default false;

-- Grandfather existing orgs so nothing you've already tested breaks. Delete
-- this line if you'd rather every org go through approval from a clean slate.
update public.organizations set verified = true where verified is not true;

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
    verified = (select o.verified from public.organizations o where o.id = organizations.id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.platform_role = 'admin')
  );

drop policy if exists "Admins can approve organizations" on public.organizations;
create policy "Admins can approve organizations"
  on public.organizations for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.platform_role = 'admin'));

-- 3a. devices — replace blanket select with scoped access
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

-- 3b. lifecycle_events — same problem, same fix shape
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

-- 3c. Require verified orgs (and a still-registered device) for a new sale
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

-- ============================================================================
-- Post-setup: set your admin account
--
-- No UI writes profiles.platform_role = 'admin' — this is deliberately a
-- manual, out-of-band step. Run once, substituting your own user id (find it
-- in Supabase -> Authentication -> Users):
--
--   update public.profiles set platform_role = 'admin' where id = '<your-user-id>';
--
-- Without this, nobody can approve organizations via /admin/organizations or
-- publish blog posts.
-- ============================================================================

-- ============================================================================
-- END
-- ============================================================================
