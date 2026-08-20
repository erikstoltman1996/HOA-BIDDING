-- Bid Ledger — Phase 2: allow more than one project per org.
--
-- The unique constraint on projects.org_id was a deliberate Phase-1-only
-- guard (see the comment in 0001_init.sql, which anticipated this exact
-- migration). Every other table keyed off project_id — line_items, bids,
-- bid_line_item_amounts, board_checkins, checkin_responses, contractors,
-- weekly_updates, photos — already has RLS scoped through
-- `project_id in (select id from public.projects where org_id = current_org_id())`,
-- a pattern that already supports many projects per org with zero changes.
-- Dropping this one constraint is the only schema change multi-project
-- support needs.

alter table public.projects drop constraint if exists projects_org_id_key;
