-- Bid Ledger — contractor portal + resident voting
-- Adds: contractors, weekly_updates, photos (board-only visibility) and
-- residents, board_polls, poll_options, poll_responses (informal resident
-- input, mirrors the board check-in's "not an official vote" posture).
--
-- Design notes:
--   * A contractor's weekly-update submission (with photo uploads) is
--     handled entirely server-side by a Next.js Server Action using the
--     service-role client after validating the token in application code —
--     no anon RPC needed here, unlike the check-in flow, because file
--     uploads can't be expressed as a pure SQL call anyway.
--   * A resident's access_token is stable and reused across every poll
--     (unlike checkin_responses' one-token-per-recipient-per-checkin), so
--     poll responses are looked up/upserted by token via a security-definer
--     RPC, the same shape as record_checkin_response_by_token but with an
--     upsert since a resident may revisit and change their vote.

-- ---------------------------------------------------------------------------
-- Contractor portal
-- ---------------------------------------------------------------------------

create table public.contractors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null default '',
  contact_email text,
  contact_phone text,
  access_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

create table public.weekly_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  contractor_id uuid not null references public.contractors (id) on delete cascade,
  week_of date not null default current_date,
  percent_complete integer not null default 0 check (percent_complete between 0 and 100),
  timeline_status text not null default 'on_track' check (timeline_status in ('on_track', 'ahead', 'delayed')),
  issues_text text,
  next_milestone_date date,
  created_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references public.weekly_updates (id) on delete cascade,
  url text not null,
  caption text,
  created_at timestamptz not null default now()
);

create index on public.contractors (project_id);
create index on public.weekly_updates (project_id);
create index on public.weekly_updates (contractor_id);
create index on public.photos (update_id);

alter table public.contractors enable row level security;
alter table public.weekly_updates enable row level security;
alter table public.photos enable row level security;

-- Board-only visibility (admins + board members) — residents never get a
-- policy on these tables at all, so they have zero access even if they
-- somehow guessed an id.
create policy "contractors: org members can view"
  on public.contractors for select
  using (project_id in (select id from public.projects where org_id = public.current_org_id()));

create policy "contractors: admins can manage"
  on public.contractors for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id() and public.current_role() = 'admin'))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id() and public.current_role() = 'admin'));

create policy "weekly_updates: org members can view"
  on public.weekly_updates for select
  using (project_id in (select id from public.projects where org_id = public.current_org_id()));

create policy "weekly_updates: admins can manage"
  on public.weekly_updates for all
  using (project_id in (select id from public.projects where org_id = public.current_org_id() and public.current_role() = 'admin'))
  with check (project_id in (select id from public.projects where org_id = public.current_org_id() and public.current_role() = 'admin'));

create policy "photos: org members can view"
  on public.photos for select
  using (update_id in (
    select wu.id from public.weekly_updates wu
    join public.projects p on p.id = wu.project_id
    where p.org_id = public.current_org_id()
  ));

create policy "photos: admins can manage"
  on public.photos for all
  using (update_id in (
    select wu.id from public.weekly_updates wu
    join public.projects p on p.id = wu.project_id
    where p.org_id = public.current_org_id() and public.current_role() = 'admin'
  ))
  with check (update_id in (
    select wu.id from public.weekly_updates wu
    join public.projects p on p.id = wu.project_id
    where p.org_id = public.current_org_id() and public.current_role() = 'admin'
  ));

-- Note: no INSERT policy exists for the anon/authenticated roles on
-- contractors/weekly_updates/photos. The public /contractor/[token] flow
-- writes via a Server Action using the service-role client (bypasses RLS),
-- after checking the token against `contractors` in application code.

-- ---------------------------------------------------------------------------
-- Resident voting — informal input only, same posture as board check-ins.
-- ---------------------------------------------------------------------------

-- Org-scoped, not project-scoped: residents live in the HOA regardless of
-- which capital project happens to be active.
create table public.residents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  unit_label text not null default '',
  contact_email text,
  access_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

create table public.board_polls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  question text not null default '',
  description text,
  respond_by date,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.board_polls (id) on delete cascade,
  label text not null default '',
  sort_order integer not null default 0
);

create table public.poll_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.board_polls (id) on delete cascade,
  resident_id uuid not null references public.residents (id) on delete cascade,
  option_id uuid references public.poll_options (id),
  note text,
  responded_at timestamptz not null default now(),
  unique (poll_id, resident_id)
);

create index on public.residents (org_id);
create index on public.board_polls (org_id);
create index on public.poll_options (poll_id);
create index on public.poll_responses (poll_id);
create index on public.poll_responses (resident_id);

alter table public.residents enable row level security;
alter table public.board_polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_responses enable row level security;

create policy "residents: org members can view"
  on public.residents for select
  using (org_id = public.current_org_id());

create policy "residents: admins can manage"
  on public.residents for all
  using (org_id = public.current_org_id() and public.current_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_role() = 'admin');

create policy "board_polls: org members can view"
  on public.board_polls for select
  using (org_id = public.current_org_id());

create policy "board_polls: admins can manage"
  on public.board_polls for all
  using (org_id = public.current_org_id() and public.current_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_role() = 'admin');

create policy "poll_options: org members can view"
  on public.poll_options for select
  using (poll_id in (select id from public.board_polls where org_id = public.current_org_id()));

create policy "poll_options: admins can manage"
  on public.poll_options for all
  using (poll_id in (select id from public.board_polls where org_id = public.current_org_id() and public.current_role() = 'admin'))
  with check (poll_id in (select id from public.board_polls where org_id = public.current_org_id() and public.current_role() = 'admin'));

create policy "poll_responses: org members can view (for tallies)"
  on public.poll_responses for select
  using (poll_id in (select id from public.board_polls where org_id = public.current_org_id()));

create policy "poll_responses: admins can manage"
  on public.poll_responses for all
  using (poll_id in (select id from public.board_polls where org_id = public.current_org_id() and public.current_role() = 'admin'))
  with check (poll_id in (select id from public.board_polls where org_id = public.current_org_id() and public.current_role() = 'admin'));

-- ---------------------------------------------------------------------------
-- RPC: record_poll_response_by_token
-- A resident's link is stable across every poll, so this resolves the
-- resident from the token, then upserts their response for the given poll —
-- they can come back and change their vote while a poll stays open.
-- ---------------------------------------------------------------------------

create or replace function public.record_poll_response_by_token(
  p_token text,
  p_poll_id uuid,
  p_option_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resident_id uuid;
begin
  select id into v_resident_id from public.residents where access_token = p_token;
  if v_resident_id is null then
    raise exception 'invalid or expired resident link';
  end if;

  insert into public.poll_responses (poll_id, resident_id, option_id, note, responded_at)
  values (p_poll_id, v_resident_id, p_option_id, p_note, now())
  on conflict (poll_id, resident_id) do update
    set option_id = excluded.option_id,
        note = excluded.note,
        responded_at = now();
end;
$$;

grant execute on function public.record_poll_response_by_token(text, uuid, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: weekly update photos
-- Public-read bucket (progress photos, low sensitivity) — writes only ever
-- happen server-side via the service-role client (contractor uploads go
-- through a Server Action, never directly from the browser), so no anon/
-- authenticated INSERT policy is defined; the default is deny.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('weekly-update-photos', 'weekly-update-photos', true)
on conflict (id) do nothing;

create policy "weekly update photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'weekly-update-photos');
