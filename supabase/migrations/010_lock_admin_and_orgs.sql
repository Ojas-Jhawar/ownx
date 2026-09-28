-- Helper: single source of truth for "is this caller an admin"
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and platform_role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated;

-- ── 1. Users can only edit harmless profile columns ─────────────────────────
revoke update on public.profiles from authenticated, anon;
grant  update (full_name, avatar_initials) on public.profiles to authenticated;

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select to authenticated using (public.is_admin());

-- ── 2. Nobody creates orgs or joins them from the client ────────────────────
drop policy if exists "Authenticated can create organizations"      on public.organizations;
drop policy if exists "Users can join an organization as themselves" on public.organization_members;
drop policy if exists "Org owners can update their organization"     on public.organizations;
drop policy if exists "Admins can approve organizations"             on public.organizations;
drop policy if exists "Authenticated can view organizations"         on public.organizations;

-- Verified orgs are visible (device pages show manufacturer names);
-- pending ones only to their own members and admins.
create policy "View verified or own organizations"
  on public.organizations for select to authenticated
  using (
    verified = true
    or public.is_admin()
    or exists (select 1 from public.organization_members m
               where m.organization_id = organizations.id and m.user_id = auth.uid())
  );

create policy "Admins manage organizations"
  on public.organizations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Admins view all memberships"
  on public.organization_members for select to authenticated using (public.is_admin());

-- ── 3a. Applications + audit log ────────────────────────────────────────────
create table if not exists public.organization_applications (
  id uuid primary key default gen_random_uuid(),
  org_name text not null,
  org_type text not null check (org_type in ('manufacturer','seller','repair_shop')),
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  website text,
  address text,
  registration_number text,            -- GSTIN / CIN / shop licence
  document_paths text[] not null default '{}',
  message text,
  status text not null default 'pending'
    check (status in ('pending','needs_info','approved','rejected')),
  review_notes text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  organization_id uuid references public.organizations (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists org_apps_status_idx on public.organization_applications (status, created_at desc);
alter table public.organization_applications enable row level security;

-- No insert policy on purpose: applicants submit through a server action
-- (service role) so we can validate, rate-limit and store documents.
create policy "Admins read applications"
  on public.organization_applications for select to authenticated using (public.is_admin());
create policy "Admins update applications"
  on public.organization_applications for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
create policy "Admins read audit log"
  on public.admin_audit_log for select to authenticated using (public.is_admin());
-- no insert/update/delete policies: only the SECURITY DEFINER function writes

-- ── 3b. The ONE way an org (and its owner membership) comes into existence ──
create or replace function public.approve_org_application(
  p_app_id uuid, p_owner_user_id uuid, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_app public.organization_applications; v_org uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  select * into v_app from public.organization_applications where id = p_app_id for update;
  if not found then raise exception 'Application not found'; end if;
  if v_app.status not in ('pending','needs_info') then raise exception 'Application already resolved'; end if;

  insert into public.organizations (name, org_type, verified)
    values (v_app.org_name, v_app.org_type, true) returning id into v_org;
  insert into public.organization_members (organization_id, user_id, role)
    values (v_org, p_owner_user_id, 'owner');
  update public.profiles set platform_role = v_app.org_type
    where id = p_owner_user_id and platform_role <> 'admin';
  update public.organization_applications
    set status='approved', organization_id=v_org, reviewed_by=auth.uid(),
        reviewed_at=now(), review_notes=p_notes
    where id = p_app_id;
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
    values (auth.uid(), 'approve_org_application', 'organization', v_org,
            jsonb_build_object('application_id', p_app_id, 'owner', p_owner_user_id));
  return v_org;
end $$;
revoke all on function public.approve_org_application(uuid,uuid,text) from public;
grant execute on function public.approve_org_application(uuid,uuid,text) to authenticated;

-- private bucket for applicant documents (GST certificate, licence, etc.)
insert into storage.buckets (id, name, public) values ('org-applications','org-applications', false)
on conflict (id) do nothing;
-- no storage policies: only the service role touches this bucket
