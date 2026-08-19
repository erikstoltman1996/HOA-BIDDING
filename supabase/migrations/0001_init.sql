-- Bid Ledger — Phase 1 schema
-- organizations, users, projects, line_items, bids, bid_line_item_amounts,
-- board_checkins, checkin_responses, plus RLS policies and the two RPCs the
-- app relies on (org creation at signup, board-member response recording).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Mirrors auth.users for the columns the app needs (role, org, display name).
-- id is the same uuid as the corresponding auth.users row.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'board_member' check (role in ('admin', 'board_member')),
  created_at timestamptz not null default now()
);

-- Phase 1: exactly one project per org. The unique constraint on org_id is a
-- deliberate Phase-1-only guard — drop it in the Phase 2 migration that adds
-- the multi-project dashboard.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations (id) on delete cascade,
  title text not null default '',
  status text not null default 'bidding' check (status in ('bidding', 'awarded', 'in_progress', 'complete')),
  budget_estimate numeric,
  created_at timestamptz not null default now()
);

-- Shared line-item rows for a project's bid comparison table — every bid
-- column shares the same set of rows, matching the ledger's UI.
create table public.line_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  label text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  vendor_name text not null default '',
  vendor_contact text,
  warranty_years numeric,
  timeline_weeks numeric,
  notes text,
  status text not null default 'submitted' check (status in ('submitted', 'awarded', 'rejected')),
  created_at timestamptz not null default now()
);

-- One cell in the ledger: a dollar amount for one bid × one line item.
-- Total per bid is the sum of its amounts, computed at query time.
create table public.bid_line_item_amounts (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids (id) on delete cascade,
  line_item_id uuid not null references public.line_items (id) on delete cascade,
  amount numeric,
  unique (bid_id, line_item_id)
);

create table public.board_checkins (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  respond_by date,
  message text,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

-- One row per board member per check-in, pre-created when the admin sends
-- the check-in so each member gets a personal, no-login token link. Also
-- updatable by the member directly if they're logged in.
create table public.checkin_responses (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.board_checkins (id) on delete cascade,
  board_member_id uuid references public.users (id),
  name text not null default '',
  email text not null default '',
  pick_bid_id uuid references public.bids (id),
  note text,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.users (org_id);
create index on public.line_items (project_id);
create index on public.bids (project_id);
create index on public.bid_line_item_amounts (bid_id);
create index on public.bid_line_item_amounts (line_item_id);
create index on public.board_checkins (project_id);
create index on public.checkin_responses (checkin_id);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so RLS policies on `users` itself don't
-- recurse into RLS when looking up the caller's own row).
-- ---------------------------------------------------------------------------

create or replace function public.current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id from public.users where id = auth.uid()
$$;

create or replace function public.current_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.line_items enable row level security;
alter table public.bids enable row level security;
alter table public.bid_line_item_amounts enable row level security;
alter table public.board_checkins enable row level security;
alter table public.checkin_responses enable row level security;

create policy "org: members can view their own org"
  on public.organizations for select
  using (id = public.current_org_id());

create policy "users: members can view their org's roster"
  on public.users for select
  using (org_id = public.current_org_id());

create policy "users: a user can update their own name"
  on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "projects: members can view their org's project"
  on public.projects for select
  using (org_id = public.current_org_id());

create policy "projects: admins can manage their org's project"
  on public.projects for all
  using (org_id = public.current_org_id() and public.current_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_role() = 'admin');

create policy "line_items: members can view"
  on public.line_items for select
  using (project_id in (select id from public.projects where org_id = public.current_org_id()));

create policy "line_items: admins can manage"
  on public.line_items for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id() and public.current_role() = 'admin'))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id() and public.current_role() = 'admin'));

create policy "bids: members can view"
  on public.bids for select
  using (project_id in (select id from public.projects where org_id = public.current_org_id()));

create policy "bids: admins can manage"
  on public.bids for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id() and public.current_role() = 'admin'))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id() and public.current_role() = 'admin'));

create policy "bid_amounts: members can view"
  on public.bid_line_item_amounts for select
  using (bid_id in (
    select b.id from public.bids b
    join public.projects p on p.id = b.project_id
    where p.org_id = public.current_org_id()
  ));

create policy "bid_amounts: admins can manage"
  on public.bid_line_item_amounts for all
  using (bid_id in (
    select b.id from public.bids b
    join public.projects p on p.id = b.project_id
    where p.org_id = public.current_org_id() and public.current_role() = 'admin'
  ))
  with check (bid_id in (
    select b.id from public.bids b
    join public.projects p on p.id = b.project_id
    where p.org_id = public.current_org_id() and public.current_role() = 'admin'
  ));

create policy "checkins: members can view"
  on public.board_checkins for select
  using (project_id in (select id from public.projects where org_id = public.current_org_id()));

create policy "checkins: admins can manage"
  on public.board_checkins for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id() and public.current_role() = 'admin'))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id() and public.current_role() = 'admin'));

create policy "checkin_responses: members can view their org's responses"
  on public.checkin_responses for select
  using (checkin_id in (
    select c.id from public.board_checkins c
    join public.projects p on p.id = c.project_id
    where p.org_id = public.current_org_id()
  ));

create policy "checkin_responses: a board member can record their own pick"
  on public.checkin_responses for update
  using (board_member_id = auth.uid())
  with check (board_member_id = auth.uid());

create policy "checkin_responses: admins can manage"
  on public.checkin_responses for all
  using (checkin_id in (
    select c.id from public.board_checkins c
    join public.projects p on p.id = c.project_id
    where p.org_id = public.current_org_id() and public.current_role() = 'admin'
  ))
  with check (checkin_id in (
    select c.id from public.board_checkins c
    join public.projects p on p.id = c.project_id
    where p.org_id = public.current_org_id() and public.current_role() = 'admin'
  ));

-- ---------------------------------------------------------------------------
-- RPC: create_org_and_admin
-- Called once, right after auth.signUp(), by the newly authenticated user.
-- Creates their organization, links their public.users row as admin, and
-- seeds a blank Phase-1 project with the prototype's starter line items so
-- the ledger isn't empty on first load.
-- ---------------------------------------------------------------------------

create or replace function public.create_org_and_admin(p_org_name text, p_admin_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_project_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.users where id = auth.uid() and org_id is not null) then
    raise exception 'this account already belongs to an organization';
  end if;

  insert into public.organizations (name) values (p_org_name) returning id into v_org_id;

  insert into public.users (id, org_id, email, name, role)
  values (auth.uid(), v_org_id, auth.email(), coalesce(nullif(p_admin_name, ''), auth.email()), 'admin')
  on conflict (id) do update
    set org_id = excluded.org_id, name = excluded.name, role = 'admin';

  insert into public.projects (org_id, title, status)
  values (v_org_id, 'New Capital Project', 'bidding')
  returning id into v_project_id;

  insert into public.line_items (project_id, label, sort_order)
  values
    (v_project_id, 'Labor', 0),
    (v_project_id, 'Materials', 1),
    (v_project_id, 'Permits & fees', 2),
    (v_project_id, 'Disposal / cleanup', 3),
    (v_project_id, 'Contingency', 4);

  return v_org_id;
end;
$$;

grant execute on function public.create_org_and_admin(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: record_checkin_response_by_token
-- Used by the public, no-login /checkin/[token] page. Runs as security
-- definer so an anonymous visitor can update exactly one row — the one
-- matching their token — without any broader table access.
-- ---------------------------------------------------------------------------

create or replace function public.record_checkin_response_by_token(
  p_token text,
  p_pick_bid_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.checkin_responses
  set pick_bid_id = p_pick_bid_id,
      note = p_note,
      responded_at = now()
  where token = p_token;

  if not found then
    raise exception 'invalid or expired check-in link';
  end if;
end;
$$;

grant execute on function public.record_checkin_response_by_token(text, uuid, text) to anon, authenticated;
