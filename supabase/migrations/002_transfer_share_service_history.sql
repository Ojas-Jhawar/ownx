-- ============================================================================
-- Migration 002 — Ownership transfer, passport sharing, richer service history
-- Run once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: every statement is idempotent (if-not-exists / drop-then-
-- create for policies).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SERVICE HISTORY — who did the work, and an attached receipt
-- ----------------------------------------------------------------------------
alter table public.service_records
  add column if not exists performed_by text,
  add column if not exists receipt_document_id uuid references public.documents (id) on delete set null;

-- ----------------------------------------------------------------------------
-- PASSPORT SHARES
-- A view-only, read-only link to a passport (not a for-sale listing). Anyone
-- with the link can see verified details + service history, nothing private.
-- ----------------------------------------------------------------------------
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

-- Let the public share page read the asset behind an active share.
drop policy if exists "Anyone can view assets behind an active share" on public.assets;
create policy "Anyone can view assets behind an active share"
  on public.assets for select
  using (
    exists (
      select 1 from public.passport_shares s
      where s.asset_id = assets.id and s.status = 'active'
    )
  );

-- Let the public share page read service history behind an active share.
drop policy if exists "Anyone can view service records behind an active share" on public.service_records;
create policy "Anyone can view service records behind an active share"
  on public.service_records for select
  using (
    exists (
      select 1 from public.passport_shares s
      where s.asset_id = service_records.asset_id and s.status = 'active'
    )
  );

-- ----------------------------------------------------------------------------
-- OWNERSHIP TRANSFERS
-- A request/accept flow: the current owner sends a transfer to a recipient's
-- email; the recipient (once logged in with that email) accepts or declines.
-- Accepting is the only step that actually reassigns the passport, and it
-- runs through a security-definer function below so it can't be forged.
-- ----------------------------------------------------------------------------
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

-- Sender may only flip a pending transfer they sent to 'cancelled'.
drop policy if exists "Sender can cancel own pending transfer" on public.ownership_transfers;
create policy "Sender can cancel own pending transfer"
  on public.ownership_transfers for update
  using (auth.uid() = from_user_id and status = 'pending')
  with check (auth.uid() = from_user_id and status = 'cancelled');

-- Recipient may only flip a pending transfer addressed to them to 'declined'.
-- (Accepting is handled exclusively by accept_ownership_transfer() below,
-- since it also has to reassign the asset's owner_id.)
drop policy if exists "Recipient can decline their pending transfer" on public.ownership_transfers;
create policy "Recipient can decline their pending transfer"
  on public.ownership_transfers for update
  using (status = 'pending' and lower(coalesce(auth.jwt() ->> 'email', '')) = lower(to_email))
  with check (status = 'declined');

-- The only path that can move an asset's owner_id to someone else. Runs as
-- the function owner (bypassing RLS) but does its own authorization checks:
-- caller must be logged in with the email the transfer was sent to, and the
-- transfer must still be pending.
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

  -- A passport that just changed hands shouldn't still be listed or shared
  -- under the previous owner's links.
  update public.listings
    set status = 'withdrawn'
    where asset_id = v_transfer.asset_id and status = 'active';

  update public.passport_shares
    set status = 'revoked'
    where asset_id = v_transfer.asset_id and status = 'active';
end;
$$;

grant execute on function public.accept_ownership_transfer(uuid) to authenticated;

-- Lets a recipient see the asset they're being offered (name, photo, etc.)
-- on the /transfers page before they've accepted and actually own it.
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
