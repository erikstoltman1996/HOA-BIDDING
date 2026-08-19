-- Bid Ledger — reserve fund tracker
-- Persists the inputs lib/ReserveTrackerService.ts needs (current balance,
-- annual contribution, and the list of community assets it tracks). The
-- unplanned-expenditure "what if" input is deliberately NOT persisted here
-- — it's modeled live in the browser against these saved numbers, so the
-- board can try scenarios without committing them.

create table public.reserve_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  current_balance numeric not null default 0,
  annual_contribution numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table public.reserve_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null default '',
  expected_lifespan_years numeric not null default 1 check (expected_lifespan_years > 0),
  replacement_cost numeric not null default 0 check (replacement_cost >= 0),
  current_age_years numeric not null default 0 check (current_age_years >= 0),
  created_at timestamptz not null default now()
);

create index on public.reserve_assets (org_id);

alter table public.reserve_settings enable row level security;
alter table public.reserve_assets enable row level security;

create policy "reserve_settings: org members can view"
  on public.reserve_settings for select
  using (org_id = public.current_org_id());

create policy "reserve_settings: admins can manage"
  on public.reserve_settings for all
  using (org_id = public.current_org_id() and public.current_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_role() = 'admin');

create policy "reserve_assets: org members can view"
  on public.reserve_assets for select
  using (org_id = public.current_org_id());

create policy "reserve_assets: admins can manage"
  on public.reserve_assets for all
  using (org_id = public.current_org_id() and public.current_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_role() = 'admin');
