# Bid Ledger — project notes for Claude

See `README.md` for stack, setup, env vars, and how the pieces fit together.
This file is durable guidance for how we build, not a one-time task list.

## Design principles from competitor research

Pulled from verified G2/Capterra reviews of PayHOA, TownSq, and the HOA
software category generally. Treat this as an ongoing filter for every
feature decision, not a checklist to satisfy once.

**Protect — things real users explicitly praise, don't erode them:**

- **Radical simplicity.** The single most repeated compliment across every
  review is some version of "so easy a non-technical volunteer could use it
  immediately." Judge every new feature against whether it threatens that,
  not just whether it's useful in isolation.
- **At-a-glance financial visibility for the board.** A recurring complaint
  elsewhere in the category is that "up-to-date financial data is not
  available to the Board" — the Home dashboard existing at all is the fix.
  Don't let future features bury it again the way `/dues` originally buried
  its summary under a unit-setup form (fixed — see the `DuesSummary` strip).

**Fill — named, recurring gaps in existing tools, worth leaning into:**

- **Reserve fund tracking is missing from the market leader (PayHOA)** by
  their own users' account. Treat `/reserve` as a real differentiator worth
  continuing to polish, not a secondary feature.
- **Rigid, non-customizable workflows are TownSq's top complaint.** Where
  reasonable, prefer configurable text/labels over hardcoded assumptions —
  e.g. don't hardcode "HOA" in UI copy if a condo association would say
  "unit owner" / "association" instead. Not urgent enough to retrofit
  everything today, but keep it in mind for new copy and schema choices.
- **Readability/color complaints show up directly** ("the presentation
  color makes the site hard to read"). Keep holding the line on the
  color-banded, high-contrast treatment already in place (`healthBand.ts`'s
  green/gold/red system, parameterized per metric) rather than drifting
  toward decorative color.
- **Formatting limitations in resident/board communications** are a named
  complaint. Keep this in mind if the check-in email, contractor/resident
  invite emails, or any future messaging feature needs richer text
  formatting later (currently plain React Email templates).

**Deferred — real complaints, but don't build yet:**

- **Bank reconciliation reliability and payment fee transparency** are the
  two most bitter complaints in the category — but they only matter once
  real payment processing exists, which Bid Ledger has deliberately deferred
  (dues tracking is V1 manual, no Stripe/online collection). Don't let this
  drive premature payment-processing work; revisit if/when that's built.
