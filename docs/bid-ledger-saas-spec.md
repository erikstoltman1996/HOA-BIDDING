# Bid Ledger — SaaS Product Spec

*Multi-project HOA capital project management, with contractor-facing progress updates.*

---

## 1. What changed

The tool so far (single bid comparison + board check-in) was a client-only file — no accounts, no persistence, no other users. What you're describing now is a different category of product: multiple organizations (HOAs), each running several projects at once, with a third kind of user — contractors — who need to submit updates without a full account. That requires a real backend: a database, authentication, file storage for photos, and a way to send email on a schedule rather than only on click. None of that can live in a single downloadable file. This spec defines what to build and in what order.

---

## 2. Who uses it

| Role | Access | Typical user |
|---|---|---|
| **Board Admin** | Full access to their HOA's org: create projects, invite board members, invite contractors, view all bids and financials | Board president, treasurer |
| **Board Member** | View projects, respond to check-ins, view contractor updates | Other directors |
| **Contractor** | Scoped to *one project*, via a magic link — no password, no full account. Can submit weekly updates and photos. Cannot see bid amounts, other vendors, or other projects | The vendor actually doing the work |
| **Homeowner (Phase 4, optional)** | Read-only project status page — no financials | Residents wanting transparency |

Contractors are the trickiest access design here: they won't create an account for a tool they touch once a week for one job. A unique per-project magic link (like the ones VoteAlly and similar voting tools use for homeowners) is the right pattern — it's low-friction and doesn't require them to manage credentials.

---

## 3. Data model

```
organizations
  id, name, state, created_at

users
  id, org_id (nullable), email, name, role [admin|board_member], created_at

projects
  id, org_id, title, status [bidding|awarded|in_progress|complete],
  budget_estimate, created_at

bids
  id, project_id, vendor_name, vendor_contact, line_items (jsonb),
  total, warranty_years, timeline_weeks, notes, status [submitted|awarded|rejected]

board_checkins
  id, project_id, respond_by, created_at

checkin_responses
  id, checkin_id, board_member_id, pick_bid_id, note, responded_at

contractors
  id, project_id, name, contact_email, contact_phone, access_token

weekly_updates
  id, project_id, contractor_id, week_of, percent_complete,
  timeline_status [on_track|ahead|delayed], issues_text, next_milestone_date, created_at

photos
  id, update_id, url, caption
```

A `contractor` is scoped to a single `project`, not the org — if the same vendor works two projects for the same HOA, they get two separate links. Keeps the access boundary simple and avoids a contractor from one job accidentally seeing another.

---

## 4. The contractor update flow (the differentiator)

This is the piece nothing else on the market does well — see the competitive research from before: RFP/bid tools live in enterprise suites, and none of them close the loop on *after* the vendor is hired.

1. Once a bid is awarded, the board admin adds the contractor's name, email, and phone to that project. The system generates a unique link and emails it to the contractor with a short explanation of what it's for.
2. Every week (configurable — weekly is the default), the contractor gets an email reminder with their link.
3. The link opens directly to a submission form — no login. It asks for:
   - **% complete** (simple slider)
   - **Status**: on track / ahead / delayed, with a short note if delayed
   - **Issues or blockers**, free text
   - **Photos** (multiple, from their phone camera roll directly)
   - **Next milestone / expected date**
4. The board sees a running timeline per project: a log of updates with photos, so anyone can see progress without asking the contractor directly or driving by the site.
5. If a contractor misses a week, the board admin sees that flagged on the dashboard rather than finding out three weeks later that nothing happened.

This turns "I haven't heard from the roofer in two weeks, is that normal?" — a real, common source of board anxiety — into something the software just answers.

---

## 5. Multi-project dashboard

Each HOA's home view becomes a list of projects, not a single bid comparison:

- Project name, status (bidding / in progress / complete), % complete if in progress
- At a glance: last contractor update date, any open board check-in awaiting responses
- Click into a project to see the full bid comparison, check-in history, and (once awarded) the contractor update timeline

---

## 6. Suggested stack

Consistent with what was scoped earlier for the micro-SaaS path:

- **Next.js** — frontend + API routes in one framework
- **Supabase** — Postgres database, authentication (for board admins/members), and file storage (for contractor photos)
- **Stripe** — subscription billing, likely tiered by number of active projects or units
- **Resend** (or similar) — transactional email: check-in requests, weekly reminder emails to contractors, magic link delivery
- **Vercel** — hosting/deploy

This is a real multi-week build, not an afternoon — worth treating as its own project in Claude Code rather than continuing in this chat, since it needs persistent infrastructure this chat can't provide.

---

## 7. Phased roadmap

| Phase | Scope | Goal |
|---|---|---|
| **0 — Validate** *(done/in progress)* | Static bid ledger tool, board check-in via email | Confirm boards actually want this before building accounts |
| **1 — MVP SaaS** | Real accounts, one project per org, bid comparison + board check-in with actual scheduled email (not just mailto) | Prove people will pay for *this alone* |
| **2 — Multi-project** | Dashboard, multiple concurrent projects per org | Support HOAs with more than one thing going on |
| **3 — Contractor portal** | Magic-link weekly updates, photos, timeline | The flagship differentiator — build once Phase 1–2 have paying users |
| **4 — Homeowner transparency page** | Optional read-only project status for residents | Upsell / stickiness feature, addresses board accountability pressure |

Building the contractor portal before anyone's paying for the bid comparison + check-in flow would be building the most expensive feature first, on an unvalidated base. Worth holding the line on that order even though the contractor piece is the most exciting part.

---

## 8. Open questions worth settling before building

- **Pricing model**: per HOA flat rate, per project, or per unit? (The competitive research found flat-rate pricing is what small self-managed boards actually prefer — per-unit models feel punitive as communities grow.)
- **Contractor link lifespan**: does it expire when the project is marked complete, or stay open for warranty-period documentation?
- **Photo storage limits**: needs a cap per project to control storage costs at scale.
- **Compliance disclaimer placement**: the board check-in legal disclaimer needs to live somewhere a board can't miss it — possibly a one-time acknowledgment when an org is created, not just inline text.
