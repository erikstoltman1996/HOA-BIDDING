# Bid Ledger

A tool for HOA boards to compare contractor bids on capital projects and gather informal
board input before a vote. Phase 1: real accounts, one project per organization, a
database-backed bid comparison ledger, and a board check-in flow that sends real email.

See `docs/bid-ledger-saas-spec.md` for the full product spec and roadmap, and
`docs/prototype.html` for the original static prototype this app's design is ported from.
This app implements Phase 1 (accounts, bid ledger, board check-in) plus two features pulled
forward from later phases: a contractor weekly-update portal with photos (Phase 3), and
informal resident voting on community decisions (a new addition beyond the original Phase 4
read-only page). Still no multi-project dashboard.

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript) — frontend + server actions
- [Supabase](https://supabase.com) — Postgres database + auth (email/password and magic link)
- [Resend](https://resend.com) + [React Email](https://react.email) — transactional email
- Tailwind CSS — styling, ported from the `bid-ledger.html` prototype's navy/paper/gold theme

## 1. Accounts you need

1. **Supabase** — create a free project at [supabase.com](https://supabase.com).
2. **Resend** — create a free account at [resend.com](https://resend.com) and generate an API key.
   You can send from Resend's shared sandbox address (`onboarding@resend.dev`) while developing;
   verify your own domain before sending to real board members in production.

## 2. Set up the database

In your Supabase project, open the SQL editor and run these three files **in order**:
`supabase/migrations/0001_init.sql`, then `0002_contractor_and_voting.sql`, then
`0003_reserve_tracker.sql`. (If you use the Supabase CLI instead: `supabase link` then
`supabase db push`.)

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
                # a demo contractor with two weekly updates, three residents, and a poll
npm run dev
```

Then visit `http://localhost:3000` and log in with the credentials the seed script prints
(demo admin: `admin@demo.bidledger.app`, board members: `pat@demo.bidledger.app` /
`sam@demo.bidledger.app`, all sharing one demo password printed by the script). Or go to
`/signup` to create your own organization from scratch. The seed script also prints the
no-login `/contractor/[token]` and `/vote/[token]` demo links.

## Tests

`npm test` runs the unit test suite (Vitest, 36 cases). Currently covers
`lib/ReserveTrackerService.ts` — the reserve-fund projection calculator behind `/reserve`.
Uses the standard reserve-study "component method": each asset's Fully Funded Balance
contribution is `replacementCost × (elapsedLife / usefulLife)`. `run()` compares percent
funded before/after a given unplanned expenditure (applied immediately, not scheduled for a
future year), then projects a configurable number of years forward — aging every asset,
triggering a scheduled replacement (optionally inflation-adjusted) whenever one hits the end
of its useful life, and compounding annual contributions plus optional interest — flagging any
year that drops below a threshold (70% by default, the standard "at risk" line used in real
reserve studies).

## How the pieces fit together

- **Auth** — Supabase Auth handles sign-up/login (password or magic link). A new admin's
  first sign-in calls the `create_org_and_admin` RPC, which creates their organization and a
  blank starter project in one transaction. Board members are invited by an admin from the
  project page (`auth.admin.inviteUserByEmail`, server-only via the service-role key) and are
  linked into the org automatically when their invite is created.
- **Bid ledger** — `app/project/page.tsx` loads the org's one Phase-1 project, its shared
  line items, its bids, and each bid's per-line-item amounts, then renders
  `BidLedgerClient`, which mirrors the prototype's UI and table exactly. Edits call Server
  Actions in `app/project/actions.ts`, debounced client-side so typing stays smooth. Board
  members see the same ledger read-only; only admins can edit.
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
  timeline and roster on `/project` are board-only — residents never see any of this.
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

## Deploying

The app is a standard Next.js app — deploys to [Vercel](https://vercel.com) with no extra
config. Set the same environment variables in the Vercel project settings, and update
`NEXT_PUBLIC_SITE_URL` and Supabase's redirect URLs to your production domain.
