-- ============================================================================
-- Migration 003 — AI Diagnose
-- Stores every AI diagnostic run (survey answers + device-check output +
-- generated score/report) for an asset. Also folded into schema.sql for
-- fresh installs.
-- ============================================================================

create table if not exists public.ai_diagnoses (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,

  category text not null,
  survey_answers jsonb not null default '{}'::jsonb,
  device_check jsonb, -- { os, command, output } when a battery/device check was run

  ai_score integer not null check (ai_score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb, -- { battery, performance, cosmetic, functionality }
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

drop policy if exists "Users can insert their own diagnoses" on public.ai_diagnoses;
create policy "Users can insert their own diagnoses"
  on public.ai_diagnoses for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can delete their own diagnoses" on public.ai_diagnoses;
create policy "Users can delete their own diagnoses"
  on public.ai_diagnoses for delete
  using (auth.uid() = owner_id);

-- Same "readable behind an active share" pattern as service_records, so a
-- shared read-only passport can show the latest AI Score too.
drop policy if exists "Anyone can view diagnoses behind an active share" on public.ai_diagnoses;
create policy "Anyone can view diagnoses behind an active share"
  on public.ai_diagnoses for select
  using (
    exists (
      select 1 from public.passport_shares s
      where s.asset_id = ai_diagnoses.asset_id and s.status = 'active'
    )
  );
