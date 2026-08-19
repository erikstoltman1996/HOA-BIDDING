import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { fmt, money } from "@/lib/money";
import { ResponseForm } from "@/components/checkin/ResponseForm";

export default async function CheckinResponsePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: response } = await supabase
    .from("checkin_responses")
    .select("*, board_checkins(id, project_id, respond_by)")
    .eq("token", token)
    .maybeSingle();

  if (!response) notFound();

  const checkin = (response as unknown as {
    board_checkins: { id: string; project_id: string; respond_by: string | null };
  }).board_checkins;

  const { data: project } = await supabase
    .from("projects")
    .select("title")
    .eq("id", checkin.project_id)
    .single();
  const { data: bids } = await supabase.from("bids").select("*").eq("project_id", checkin.project_id);
  const { data: amounts } = await supabase
    .from("bid_line_item_amounts")
    .select("*")
    .in("bid_id", (bids ?? []).map((b) => b.id));

  const totals = (bids ?? []).map((b) => {
    const rows = (amounts ?? []).filter((a) => a.bid_id === b.id);
    const sum = rows.reduce((acc, r) => acc + (money(r.amount) ?? 0), 0);
    return rows.length ? sum : null;
  });
  const validTotals = totals.filter((t): t is number => t !== null);
  const lowest = validTotals.length ? Math.min(...validTotals) : null;

  const bidSummaries = (bids ?? []).map((b, i) => ({
    id: b.id,
    vendor: b.vendor_name || "(unnamed vendor)",
    total: fmt(totals[i]),
    isLowest: totals[i] !== null && totals[i] === lowest,
  }));

  return (
    <div className="min-h-screen w-full bg-paper p-4 sm:p-8">
      <div className="mx-auto max-w-lg rounded border border-rule bg-paper-card shadow-card p-5 sm:p-8">
        <ResponseForm
          token={token}
          projectTitle={project?.title || "Bid Comparison"}
          bids={bidSummaries}
          initialPickBidId={response.pick_bid_id}
          initialNote={response.note}
          alreadyResponded={!!response.responded_at}
        />
        {checkin.respond_by && (
          <p className="mt-4 text-center text-xs text-ink-soft">
            Response requested by {checkin.respond_by}.
          </p>
        )}
      </div>
    </div>
  );
}
