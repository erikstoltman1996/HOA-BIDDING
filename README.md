# Bid Ledger

A tool for HOA boards to compare contractor bids on capital projects and gather informal
board input before a vote. Phase 1: real accounts, one project per organization, a
database-backed bid comparison ledger, and a board check-in flow that sends real email.

See `docs/bid-ledger-saas-spec.md` for the full product spec and roadmap, and
`docs/prototype.html` for the original static prototype this app's design is ported from.
This app implements **Phase 1** only — no multi-project dashboard, no contractor portal yet.

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

In your Supabase project, open the SQL editor and run the contents of
`supabase/migrations/0001_init.sql`. (If you use the Supabase CLI instead:
`supabase link` then `supabase db push`.)

This creates all Phase 1 tables (`organizations`, `users`, `projects`, `line_items`, `bids`,
`bid_line_item_amounts`, `board_checkins`, `checkin_responses`), row-level security policies
scoping every table to the caller's org, and two RPC functions the app calls directly:
`create_org_and_admin` (run once at signup) and `record_checkin_response_by_token` (the
no-login board check-in response).

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
npm run seed   # creates a demo org, admin, two board members, a project, and sample bids
npm run dev
```

Then visit `http://localhost:3000` and log in with the credentials the seed script prints
(demo admin: `admin@demo.bidledger.app`, board members: `pat@demo.bidledger.app` /
`sam@demo.bidledger.app`, all sharing one demo password printed by the script). Or go to
`/signup` to create your own organization from scratch.

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

## Deploying

The app is a standard Next.js app — deploys to [Vercel](https://vercel.com) with no extra
config. Set the same environment variables in the Vercel project settings, and update
`NEXT_PUBLIC_SITE_URL` and Supabase's redirect URLs to your production domain.
