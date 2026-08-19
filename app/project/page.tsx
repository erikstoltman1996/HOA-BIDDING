import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { fmt, money } from "@/lib/money";
import { BidLedgerClient, type BidRow, type LineItemRow } from "@/components/bid-ledger/BidLedgerClient";
import { CheckinPanel, type CheckinRow } from "@/components/checkin/CheckinPanel";
import { ContractorPanel, type WeeklyUpdateRow } from "@/components/contractor/ContractorPanel";
import { SignOutButton } from "@/components/SignOutButton";

export default async function ProjectPage() {
  const { authUser, profile } = await requireUser();
  const supabase = await createClient();

  if (!profile.org_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-8 text-center">
        <div>
          <p className="mb-2 font-serif text-xl text-ink">No organization yet</p>
          <p className="text-sm text-ink-soft">
            Your account isn&apos;t linked to an HOA yet. Ask your board admin to invite you, or{" "}
            <Link href="/signup" className="underline">
              create a new organization
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const [{ data: org }, { data: project }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", profile.org_id).single(),
    supabase.from("projects").select("*").eq("org_id", profile.org_id).single(),
  ]);

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-8 text-center">
        <p className="text-sm text-ink-soft">No project set up for {org?.name ?? "your organization"} yet.</p>
      </div>
    );
  }

  const [{ data: lineItems }, { data: bidsRaw }, { data: boardMembers }, { data: checkinsRaw }] =
    await Promise.all([
      supabase.from("line_items").select("*").eq("project_id", project.id).order("sort_order"),
      supabase.from("bids").select("*").eq("project_id", project.id).order("created_at"),
      supabase
        .from("users")
        .select("id, name, email")
        .eq("org_id", profile.org_id)
        .eq("role", "board_member")
        .order("name"),
      supabase
        .from("board_checkins")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false }),
    ]);

  const bidIds = (bidsRaw ?? []).map((b) => b.id);
  const { data: amounts } = bidIds.length
    ? await supabase.from("bid_line_item_amounts").select("*").in("bid_id", bidIds)
    : { data: [] };

  const bids: BidRow[] = (bidsRaw ?? []).map((b) => ({
    id: b.id,
    vendor_name: b.vendor_name,
    warranty_years: b.warranty_years,
    timeline_weeks: b.timeline_weeks,
    notes: b.notes,
    amounts: Object.fromEntries(
      (amounts ?? [])
        .filter((a) => a.bid_id === b.id)
        .map((a) => [a.line_item_id, a.amount === null ? "" : String(a.amount)]),
    ),
  }));

  const items: LineItemRow[] = (lineItems ?? []).map((it) => ({ id: it.id, label: it.label }));

  // Totals for the check-in panel's tally (same rule as BidLedgerClient).
  const totals = bids.map((b) => {
    let sum = 0;
    let hasAny = false;
    items.forEach((it) => {
      const v = money(b.amounts[it.id]);
      if (v !== null) {
        sum += v;
        hasAny = true;
      }
    });
    return hasAny ? sum : null;
  });
  const validTotals = totals.filter((t): t is number => t !== null);
  const lowest = validTotals.length ? Math.min(...validTotals) : null;
  const checkinBids = bids.map((b, i) => ({
    id: b.id,
    vendor: b.vendor_name || "(unnamed vendor)",
    total: fmt(totals[i]),
    isLowest: totals[i] !== null && totals[i] === lowest,
  }));

  const checkinIds = (checkinsRaw ?? []).map((c) => c.id);
  const [{ data: responses }, { data: contractors }] = await Promise.all([
    checkinIds.length
      ? supabase.from("checkin_responses").select("*").in("checkin_id", checkinIds)
      : Promise.resolve({ data: [] }),
    supabase.from("contractors").select("*").eq("project_id", project.id).order("created_at"),
  ]);

  const contractorIds = (contractors ?? []).map((c) => c.id);
  const { data: weeklyUpdatesRaw } = contractorIds.length
    ? await supabase
        .from("weekly_updates")
        .select("*")
        .in("contractor_id", contractorIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const updateIds = (weeklyUpdatesRaw ?? []).map((u) => u.id);
  const { data: photos } = updateIds.length
    ? await supabase.from("photos").select("*").in("update_id", updateIds)
    : { data: [] };

  const weeklyUpdates: WeeklyUpdateRow[] = (weeklyUpdatesRaw ?? []).map((u) => ({
    id: u.id,
    contractor_id: u.contractor_id,
    week_of: u.week_of,
    percent_complete: u.percent_complete,
    timeline_status: u.timeline_status,
    issues_text: u.issues_text,
    next_milestone_date: u.next_milestone_date,
    created_at: u.created_at,
    photos: (photos ?? [])
      .filter((p) => p.update_id === u.id)
      .map((p) => ({ id: p.id, url: p.url, caption: p.caption })),
  }));

  const checkins: CheckinRow[] = (checkinsRaw ?? []).map((c) => ({
    id: c.id,
    respond_by: c.respond_by,
    created_at: c.created_at,
    responses: (responses ?? [])
      .filter((r) => r.checkin_id === c.id)
      .map((r) => ({
        id: r.id,
        board_member_id: r.board_member_id,
        name: r.name,
        email: r.email,
        pick_bid_id: r.pick_bid_id,
        note: r.note,
        token: r.token,
        responded_at: r.responded_at,
      })),
  }));

  const isAdmin = profile.role === "admin";

  return (
    <div className="min-h-screen w-full p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs text-ink-soft">
            {org?.name} · {profile.name || authUser.email} ({profile.role.replace("_", " ")})
          </div>
          <SignOutButton />
        </div>

        <BidLedgerClient
          projectId={project.id}
          initialTitle={project.title}
          initialItems={items}
          initialBids={bids}
          isAdmin={isAdmin}
        />

        <CheckinPanel
          projectId={project.id}
          isAdmin={isAdmin}
          currentUserId={profile.id}
          boardMembers={boardMembers ?? []}
          bids={checkinBids}
          checkins={checkins}
        />

        <ContractorPanel
          projectId={project.id}
          isAdmin={isAdmin}
          contractors={contractors ?? []}
          updates={weeklyUpdates}
          // This is an async Server Component — it renders once per request
          // on the server, not repeatedly like a client component under
          // Strict Mode/concurrent rendering, so a one-time Date.now() here
          // carries none of the purity/hydration risk the lint rule guards
          // against on the client.
          // eslint-disable-next-line react-hooks/purity
          now={Date.now()}
        />

        <div className="mt-10 flex flex-wrap gap-4 border-t-2 border-ink pt-6">
          <Link href="/community" className="text-sm text-ink underline hover:text-gold">
            Manage residents &amp; community decisions →
          </Link>
          <Link href="/reserve" className="text-sm text-ink underline hover:text-gold">
            Reserve fund outlook →
          </Link>
        </div>
      </div>
    </div>
  );
}
