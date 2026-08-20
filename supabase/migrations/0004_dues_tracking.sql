-- Bid Ledger — HOA dues tracking (V1: manual, no online payment collection)
-- units (owner-billed households) + dues_charges (one row per unit per
-- billing period). Admins manage; board members view read-only — same
-- org-scoped RLS shape as every other table in this schema.

create table public.units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  label text not null default '',
  owner_name text not null default '',
  owner_email text,
  monthly_dues_amount numeric not null default 0 check (monthly_dues_amount >= 0),
  created_at timestamptz not null default now()
);

create table public.dues_charges (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  -- First-of-month convention, e.g. 2026-08-01, so one row per unit per
  -- calendar month. The unique constraint below is what makes
  -- generate_charges_for_period idempotent.
  period date not null,
  amount_due numeric not null check (amount_due >= 0),
  paid_date date,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'waived')),
  created_at timestamptz not null default now(),
  unique (unit_id, period),
  check (status <> 'paid' or paid_date is not null)
);

create index on public.units (org_id);
create index on public.dues_charges (unit_id);
create index on public.dues_charges (period);

alter table public.units enable row level security;
alter table public.dues_charges enable row level security;

create policy "units: org members can view"
  on public.units for select
  using (org_id = public.current_org_id());

create policy "units: admins can manage"
  on public.units for all
  using (org_id = public.current_org_id() and public.current_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_role() = 'admin');

create policy "dues_charges: org members can view"
  on public.dues_charges for select
  using (unit_id in (select id from public.units where org_id = public.current_org_id()));

create policy "dues_charges: admins can manage"
  on public.dues_charges for all
  using (unit_id in (select id from public.units where org_id = public.current_org_id() and public.current_role() = 'admin'))
  with check (unit_id in (select id from public.units where org_id = public.current_org_id() and public.current_role() = 'admin'));
