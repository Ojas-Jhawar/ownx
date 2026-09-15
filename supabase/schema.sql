-- ============================================================================
-- Ownx.io database schema
-- Run this once in Supabase: Project -> SQL Editor -> New query -> paste -> Run
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

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

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

create policy "Users can view their own assets"
  on public.assets for select
  using (auth.uid() = owner_id);

create policy "Users can insert their own assets"
  on public.assets for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own assets"
  on public.assets for update
  using (auth.uid() = owner_id);

create policy "Users can delete their own assets"
  on public.assets for delete
  using (auth.uid() = owner_id);

-- Lets the public /p/[slug] listing page read just enough asset data to
-- render, without exposing any asset that isn't attached to an active listing.
create policy "Anyone can view assets behind an active listing"
  on public.assets for select
  using (
    exists (
      select 1 from public.listings l
      where l.asset_id = assets.id and l.status = 'active'
    )
  );

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

create policy "Users can view their own documents"
  on public.documents for select
  using (auth.uid() = owner_id);

create policy "Users can insert their own documents"
  on public.documents for insert
  with check (auth.uid() = owner_id);

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

create policy "Users can view their own service records"
  on public.service_records for select
  using (auth.uid() = owner_id);

create policy "Users can insert their own service records"
  on public.service_records for insert
  with check (auth.uid() = owner_id);

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
create policy "Users can view their own listings"
  on public.listings for select
  using (auth.uid() = owner_id);

create policy "Users can insert their own listings"
  on public.listings for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own listings"
  on public.listings for update
  using (auth.uid() = owner_id);

-- Anyone (including anonymous visitors) can view an ACTIVE listing by slug.
-- This is what makes /p/[slug] work as a public shareable page.
create policy "Anyone can view active listings"
  on public.listings for select
  using (status = 'active');

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

create policy "Users can upload to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view their own files"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own files"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- Migration 002 — Ownership transfer, passport sharing, richer service history
-- (Folded into this file for fresh installs. If you already ran schema.sql
-- before this was added, run supabase/migrations/002_transfer_share_service_history.sql
-- instead — it's the same content, safe to run on its own.)
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
