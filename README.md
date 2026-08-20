# Bid Ledger

A tool for HOA boards to compare contractor bids on capital projects and gather informal
board input before a vote. Phase 1: real accounts, a database-backed bid comparison ledger,
and a board check-in flow that sends real email. Multi-project support (an org can run more
than one capital project, past or current) was added in Phase 2.

See `docs/bid-ledger-saas-spec.md` for the full product spec and roadmap, and
`docs/prototype.html` for the original static prototype this app's design is ported from.
This app implements Phase 1 (accounts, bid ledger, board check-in) plus several features
pulled forward from later phases or added since: a contractor weekly-update portal with
photos (Phase 3), informal resident voting on community decisions (a new addition beyond the
original Phase 4 read-only page), a reserve-fund 10-year outlook calculator, manual HOA dues
tracking, and a Money & Funding dashboard tying all three together as the home page. Still no
multi-project dashboard.

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript) — frontend + server actions
- [Supabase](https://supabase.com) — Postgres database + auth (email/password and magic link)
- [Resend](https://resend.com) + [React Email](https://react.email) — transactional email
- Tailwind CSS — styling, ported from the `bid-ledger.html` prototype's navy/paper/gold theme,
  with Source Serif 4 (via `next/font/google`) for headers instead of the browser's system serif

## 1. Accounts you need

1. **Supabase** — create a free project at [supabase.com](https://supabase.com).
2. **Resend** — create a free account at [resend.com](https://resend.com) and generate an API key.
   You can send from Resend's shared sandbox address (`onboarding@resend.dev`) while developing;
   verify your own domain before sending to real board members in production.

## 2. Set up the database

In your Supabase project, open the SQL editor and run these five files **in order**:
`supabase/migrations/0001_init.sql`, then `0002_contractor_and_voting.sql`, then
`0003_reserve_tracker.sql`, then `0004_dues_tracking.sql`, then `0005_multi_project.sql`.
(If you use the Supabase CLI instead: `supabase link` then `supabase db push`.)

`0001_init.sql` creates the Phase 1 tables (`organizations`, `users`, `projects`, `line_items`,
`bids`, `bid_line_item_amounts`, `board_checkins`, `checkin_responses`), row-level security
policies scoping every table to the caller's org, and two RPCs: `create_org_and_admin` (run
once at signup) and `record_checkin_response_by_token` (the no-login board check-in response).

`0002_contractor_and_voting.sql` adds the contractor portal (`contractors`, `weekly_updates`,
`photos` — board-only visibility) and resident voting (`residents`, `board_polls`,
`poll_options`, `poll_responses`), plus the `record_poll_response_by_token` RPC and a public
`weekly-update-photos` Supabase Storage bucket for contractor photo uploads (created by the
migration itself — no separate dashboard step needed).

`0003_reserve_tracker.sql` adds `reserve_settings` (current balance, planned annual
contribution — one row per org) and `reserve_assets` (the community assets tracked for the
10-year outlook on `/reserve`).

`0004_dues_tracking.sql` adds `units` (owner-billed households — separate from `residents`,
which is about voting access, not billing) and `dues_charges` (one row per unit per calendar
month, `unpaid` / `paid` / `waived`, with a check constraint requiring a `paid_date` whenever
status is `paid`). V1 is entirely manual — no Stripe, no online payment collection.

`0005_multi_project.sql` drops the Phase-1-only unique constraint that limited an org to
exactly one project. Every other project-scoped table (`line_items`, `bids`,
`board_checkins`, `contractors`, `weekly_updates`) already keyed off `project_id` with RLS
already scoped to "any project in my org," so this was the only schema change multi-project
support needed — the rest was routing (`/project/[id]` instead of a fixed `/project`) and a
new `/projects` list page.

## 3. Configure auth redirects

In the Supabase dashboard: **Authentication → URL Configuration**, set:
- **Site URL**: `http://localhost:3000` (or your deployed URL)
- **Redirect URLs**: add `http://localhost:3000/auth/callback` (and your deployed
  `https://.../auth/callback` once hosted)

Without this, magic-link and email-confirmation links won't redirect back into the app.

## 4. Environment variables

Copy the example file and fill in real values:

```bash
cp .env.local.example .env.local
```

| Variable | What it's for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (Project Settings → API). Public. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key. Safe to expose to the browser — RLS enforces access. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key. **Server-only, never exposed to the browser.** Used to invite board members (`auth.admin.inviteUserByEmail`) and by the seed script. |
| `RESEND_API_KEY` | Resend API key for sending check-in emails. Server-only. |
| `RESEND_FROM_EMAIL` | The "from" address for check-in emails, e.g. `"Bid Ledger <notify@yourdomain.com>"`. Leave unset in dev to use Resend's sandbox sender. |
| `NEXT_PUBLIC_SITE_URL` | Base URL used to build check-in links in emails and auth redirects. `http://localhost:3000` locally. |

`.env.local` is gitignored — never commit real keys.

## 5. Install, seed, run

```bash
npm install
npm run seed   # creates a demo org, admin, two board members, a project, sample bids,
                # a demo contractor with two weekly updates, three residents, a poll,
                # reserve fund settings + four sample assets, and four dues-paying units
                # with a realistic paid/unpaid/waived mix for this period and last period
npm run dev
```

Then visit `http://localhost:3000` and log in with the credentials the seed script prints
(demo admin: `admin@demo.bidledger.app`, board members: `pat@demo.bidledger.app` /
`sam@demo.bidledger.app`, all sharing one demo password printed by the script). Or go to
`/signup` to create your own organization from scratch. The seed script also prints the
no-login `/contractor/[token]` and `/vote/[token]` demo links.

## Tests

`npm test` runs the unit test suite (Vitest, 50 cases across two files):

- `lib/ReserveTrackerService.ts` (36 cases) — the reserve-fund projection calculator behind
  `/reserve`. Uses the standard reserve-study "component method": each asset's Fully Funded
  Balance contribution is `replacementCost × (elapsedLife / usefulLife)`. `run()` compares
  percent funded before/after a given unplanned expenditure (applied immediately, not
  scheduled for a future year), then projects a configurable number of years forward — aging
  every asset, triggering a scheduled replacement (optionally inflation-adjusted) whenever one
  hits the end of its useful life, and compounding annual contributions plus optional interest
  — flagging any year that drops below a threshold (70% by default).
- `lib/dues.ts` (14 cases) — period-key math (including year-boundary rollover) and
  `calculateCollectionRate`, which is `paid / (paid + unpaid)` with **waived charges excluded
  from both the numerator and denominator** — a waiver never makes the collection rate look
  better than it is.

Both use the same green/gold/red health-band thresholds (70% / 30%) via `lib/healthBand.ts`.

## How the pieces fit together

- **Auth** — Supabase Auth handles sign-up/login (password or magic link). A new admin's
  first sign-in calls the `create_org_and_admin` RPC, which creates their organization and a
  blank starter project in one transaction. Board members are invited by an admin from the
  project page (`auth.admin.inviteUserByEmail`, server-only via the service-role key) and are
  linked into the org automatically when their invite is created. Login, signup, and the auth
  callback all land on `/` by default afterward.
- **Home — Money & Funding dashboard** (`app/page.tsx`) — the landing page after login,
  built around the three things a board actually manages money for: projects, reserves, and
  dues. Top row: three big, color-banded stat tiles (reserve percent-funded, this period's dues
  collection rate, active project count) using the same green/gold/red thresholds as `/reserve`.
  Below: a condensed Reserves summary linking to the full outlook, a Projects card linking into
  the bid ledger (currently always at most one, since Phase 1's schema still enforces one
  project per org), and a live Dues section — the real table, not a summary, so an admin can
  mark a charge paid right from the dashboard. Community Decisions isn't part of this dashboard
  (it isn't a money feature) but stays one click away via `SectionNav`.
- **Shared chrome** — `components/AppHeader.tsx` (logo linking home, org name, current section,
  user info, sign out) and `components/SectionNav.tsx` (tabs between Bid Ledger / Community /
  Reserve Fund / Dues) are used on every logged-in page for a consistent header and lateral
  navigation, instead of each page rolling its own. `components/Logo.tsx` is the small
  navy/gold monogram mark, reused at a larger size as `app/icon.svg` for the favicon.
- **Bid ledger** — `/projects` lists every project in the org as a status-dotted card
  (bidding/awarded/in-progress/complete, plus a live bid range); admins get a "New project"
  button there. `app/project/[id]/page.tsx` loads one specific project — its shared line
  items, its bids, and each bid's per-line-item amounts — then renders `BidLedgerClient`,
  which mirrors the prototype's UI and table exactly. Edits call Server Actions in
  `app/project/actions.ts`, debounced client-side so typing stays smooth. Board members see
  the same ledger read-only; only admins can edit or create projects.
- **Board check-in** — An admin picks board members and an optional response-by date and
  sends a check-in. This creates one `checkin_responses` row per recipient (each with its own
  random token) and emails each one a personal link via Resend (`lib/email/resend.ts`,
  `emails/CheckinEmail.tsx`). The link opens `/checkin/[token]` — no login required — where
  they pick a vendor and leave a note. The same response form is reused inline on the project
  page for board members who are logged in, so either path works. Every place a pick can be
  recorded shows the same "this is not an official vote" disclaimer
  (`components/checkin/CheckinDisclaimer.tsx`).
- **Contractor updates** — an admin adds a contractor (name, email, phone) to the project;
  if an email is given they get a Resend email with a personal, stable link
  (`emails/ContractorInviteEmail.tsx`). That link opens `/contractor/[token]` — no login,
  reused every week — where they post % complete, an on-track/ahead/delayed status, issues,
  a next-milestone date, and up to 6 photos. Submission is a Server Action
  (`app/contractor/[token]/actions.ts`) that validates the token and writes with the
  service-role client — contractors never get a Supabase Auth session or a table grant.
  Photos upload to a public Supabase Storage bucket; only the URL is ever exposed. The
  timeline and roster on a project's ledger page are board-only — residents never see any
  of this.
- **Resident voting** — org-scoped, not tied to a project, since residents live in the HOA
  regardless of which capital project is active. An admin manages a `residents` list
  (`/community`, each with a stable per-unit link, emailed via `emails/ResidentInviteEmail.tsx`
  if an address is on file, otherwise copy-and-share manually) and publishes polls with 2+
  options. `/vote/[token]` lists open polls for that resident's org; voting calls the
  `record_poll_response_by_token` RPC directly from the browser (same shape as check-in
  responses, but upserts since a resident's link is reused across every future poll rather
  than being single-use). Carries the same non-binding disclaimer as the board check-in —
  this is informal input, not a substitute for whatever your bylaws and state law require for
  an actual vote on spending.
- **Reserve fund outlook** (`/reserve`) — an admin sets the current reserve balance, a planned
  annual contribution, and the community assets being tracked (name, replacement cost,
  expected lifespan, current age); board members see it read-only. `lib/ReserveTrackerService.ts`
  runs entirely client-side against those numbers plus a live, unsaved "what if I had to spend
  $X right now" scenario (optionally tied to one of the tracked assets, and optionally with
  interest/inflation rates), showing percent-funded before vs. after that expenditure and then
  a 10-year table projecting forward from there — flagging any year that drops below 70%.
  The stored schema tracks each asset's *age*; the service itself works in terms of *remaining
  life*, so the component converts between the two rather than the schema mirroring the
  service's field names. Nothing about the what-if scenario is persisted; only the balance,
  contribution, and asset list are.
- **Dues tracking** (`/dues`) — V1 is deliberately manual: no Stripe, no online payment
  collection. An admin maintains a `units` roster (label, owner, monthly amount) and clicks
  "Generate this period's charges" to create one `dues_charges` row per unit at that unit's
  rate — idempotent, so re-clicking or adding a unit mid-month never duplicates a charge
  (enforced by a `unique (unit_id, period)` constraint, not just app logic). Admins mark each
  charge paid, unpaid, or waived (e.g. a hardship case, or a unit the HOA itself owns); board
  members see the same table read-only. The period navigator (`lib/dues.ts`) steps by calendar
  month. `components/dues/DuesTable.tsx` is shared verbatim between `/dues` and the dashboard's
  live current-period table — sorted unpaid-first, since that's what needs attention — and
  `lib/duesData.ts` holds the units+charges merge query both pages call, so that logic exists
  in exactly one place. The collection-rate stat is `paid / (paid + unpaid)`, with waived
  charges excluded from both sides of that fraction on purpose, so a waiver can't make the rate
  look better than it is.
- **CSV export** — the bid ledger, the reserve 10-year outlook, and a dues period each have an
  "Export CSV" button (`components/ExportCsvButton.tsx`, `lib/csv.ts` — a small RFC 4180
  builder, no dependency needed for something this size). Available to any org member, the
  same access level as viewing the page — this is read-only, not an admin action.

## Deploying

The app is a standard Next.js app — deploys to [Vercel](https://vercel.com) with no extra
config. Set the same environment variables in the Vercel project settings, and update
`NEXT_PUBLIC_SITE_URL` and Supabase's redirect URLs to your production domain.

## Production readiness

Things worth doing before a real HOA's data lives in this, roughly in order:

**CI (done).** `.github/workflows/ci.yml` runs lint, typecheck, tests, and a full build on
every push and PR. It needs no secrets — verified that `next build` succeeds with zero
Supabase/Resend env vars present, since no route fetches data at build/static-generation
time (everything data-dependent is server-rendered per request, not pre-rendered).

**Separate prod Supabase project (not done — needs you).** Right now there's one Supabase
project doing double duty as both the demo/testing database and (if you deploy this
somewhere real) production. Before a real HOA's data goes in:

1. Create a new project at [supabase.com](https://supabase.com) — pick a real name (e.g.
   the org name, not "demo").
2. Run all five migrations from `supabase/migrations/` against it, in order, in the SQL
   editor (same process as the first setup — see [§2](#2-set-up-the-database) above).
3. Grab that project's URL, publishable key, and secret key from Project Settings → API.
4. Set those as the env vars on your production Vercel deployment (keep the old project's
   keys for local dev/demo only).
5. **Don't run `npm run seed` against it** — that script exists for demo data only.

**Error monitoring.**
- **Available today, zero setup:** Vercel's own dashboard (Deployments → a deployment →
  Runtime Logs, and the Observability tab) already shows errors and exceptions thrown in
  server-side code for any deployment on Vercel. Worth checking there before adding
  anything else.
- **For richer tracking** (client-side errors, stack traces with source maps, alerting,
  error grouping over time): add [Sentry](https://sentry.io). Not wired into the code yet
  — it needs a real account and DSN first, and its Next.js SDK setup is specific to the
  exact Next.js/Sentry versions in use, which is worth getting right against a real
  account rather than guessing. Once you have a Sentry project: `npx @sentry/wizard@latest
  -i nextjs` from the repo root walks through it interactively and wires it up correctly
  for this Next.js version.

**Rate limiting on public token pages.** `/checkin/[token]`, `/contractor/[token]`, and
`/vote/[token]` have no rate limiting — nothing stops automated hammering of those routes
today. Worth adding (e.g. Vercel's own rate-limiting, or Upstash) before this is used by
people outside your own testing.
