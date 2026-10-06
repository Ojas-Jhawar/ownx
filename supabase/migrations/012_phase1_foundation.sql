-- Migration 012: Phase 1 foundation.
-- Safe to re-run.

-- 1. Waitlist (inserted only via server action using the service role)
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'marketplace',
  ip_hash text,
  created_at timestamptz not null default now()
);
create unique index if not exists waitlist_email_source_idx on public.waitlist (lower(email), source);
create index if not exists waitlist_ip_idx on public.waitlist (ip_hash, created_at desc);
alter table public.waitlist enable row level security;
drop policy if exists "Admins read waitlist" on public.waitlist;
create policy "Admins read waitlist" on public.waitlist for select to authenticated using (public.is_admin());

-- 2. Columns the admin UI and actions already read/write but no migration created
alter table public.organizations
  add column if not exists registration_number text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists onboarding_notes text;

create unique index if not exists organizations_reg_no_uidx
  on public.organizations (lower(trim(registration_number)))
  where registration_number is not null and trim(registration_number) <> '';

-- 3. RPC called by app/actions/organizations.ts (createOrganizationForOwner)
create or replace function public.admin_create_organization(
  p_name text,
  p_type text,
  p_owner_user_id uuid,
  p_registration_number text,
  p_contact_email text,
  p_contact_phone text default null,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_type not in ('manufacturer','seller','repair_shop') then raise exception 'Invalid organisation type'; end if;

  insert into public.organizations (name, org_type, verified, registration_number, contact_email, contact_phone, onboarding_notes)
  values (p_name, p_type, true, p_registration_number, p_contact_email, p_contact_phone, p_notes)
  returning id into v_org;

  insert into public.organization_members (organization_id, user_id, role) values (v_org, p_owner_user_id, 'owner');

  update public.profiles set platform_role = p_type where id = p_owner_user_id and platform_role <> 'admin';

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'create_organization', 'organization', v_org, jsonb_build_object('owner', p_owner_user_id));

  return v_org;
end $$;
revoke all on function public.admin_create_organization(text,text,uuid,text,text,text,text) from public;
grant execute on function public.admin_create_organization(text,text,uuid,text,text,text,text) to authenticated;

-- 4. Self-reported serials become a warning, not a hard block (roadmap 2.2).
--    The hard constraint stays on devices only.
drop index if exists public.assets_serial_unique_idx;
create index if not exists assets_serial_idx on public.assets (lower(trim(serial_number)))
  where serial_number is not null and trim(serial_number) <> '';
