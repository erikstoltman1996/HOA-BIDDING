-- Bid Ledger — operating expense tracking by category
-- expense_categories (admin-managed, e.g. "Insurance", "Snow Plowing") +
-- expense_entries (one row per category per month — an amount either has
-- or hasn't been entered yet for that period; no paid/unpaid workflow like
-- dues_charges, since an expense is a fact once entered, not a receivable
-- to collect). Same org-scoped RLS shape as every other table here.

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.expense_entries (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.expense_categories (id) on delete cascade,
  -- First-of-month convention, e.g. 2026-08-01, matching dues_charges.period.
  period date not null,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (category_id, period)
);

create index on public.expense_categories (org_id);
create index on public.expense_entries (category_id);
create index on public.expense_entries (period);

alter table public.expense_categories enable row level security;
alter table public.expense_entries enable row level security;

create policy "expense_categories: org members can view"
  on public.expense_categories for select
  using (org_id = public.current_org_id());

create policy "expense_categories: admins can manage"
  on public.expense_categories for all
  using (org_id = public.current_org_id() and public.current_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_role() = 'admin');

create policy "expense_entries: org members can view"
  on public.expense_entries for select
  using (category_id in (select id from public.expense_categories where org_id = public.current_org_id()));

create policy "expense_entries: admins can manage"
  on public.expense_entries for all
  using (category_id in (select id from public.expense_categories where org_id = public.current_org_id() and public.current_role() = 'admin'))
  with check (category_id in (select id from public.expense_categories where org_id = public.current_org_id() and public.current_role() = 'admin'));
