import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { fmt } from "@/lib/money";

export interface ProjectBidSummary {
  bidCount: number;
  bidRange: { min: number; max: number } | null;
}

/**
 * Bid count + valid-total range for one project, computed from
 * bids/line_items/bid_line_item_amounts the same way the ledger itself
 * does (a bid only counts toward the range once it has at least one
 * amount entered). Shared between the Home dashboard's current-project
 * card and the /projects list so this logic lives in exactly one place.
 */
export async function computeBidSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
): Promise<ProjectBidSummary> {
  const [{ data: bidsRaw }, { data: lineItemsRaw }] = await Promise.all([
    supabase.from("bids").select("id").eq("project_id", projectId),
    supabase.from("line_items").select("id").eq("project_id", projectId),
  ]);

  const bidCount = (bidsRaw ?? []).length;
  const bidIds = (bidsRaw ?? []).map((b) => b.id);
  const lineItemIds = new Set((lineItemsRaw ?? []).map((li) => li.id));

  let bidRange: { min: number; max: number } | null = null;
  if (bidIds.length > 0 && lineItemIds.size > 0) {
    const { data: amountsRaw } = await supabase
      .from("bid_line_item_amounts")
      .select("bid_id, line_item_id, amount")
      .in("bid_id", bidIds);
    const totalsByBid = new Map<string, number>();
    for (const a of amountsRaw ?? []) {
      if (!lineItemIds.has(a.line_item_id) || a.amount === null) continue;
      totalsByBid.set(a.bid_id, (totalsByBid.get(a.bid_id) ?? 0) + a.amount);
    }
    const validTotals = [...totalsByBid.values()];
    if (validTotals.length > 0) {
      bidRange = { min: Math.min(...validTotals), max: Math.max(...validTotals) };
    }
  }

  return { bidCount, bidRange };
}

/** Formats a ProjectBidSummary the same way everywhere it's shown. */
export function formatBidSummary(summary: ProjectBidSummary): string {
  if (summary.bidCount === 0) return "No bids yet";
  if (!summary.bidRange) {
    return `${summary.bidCount} bid${summary.bidCount === 1 ? "" : "s"} · amounts not entered yet`;
  }
  const { min, max } = summary.bidRange;
  if (min === max) {
    return `${fmt(min)} · ${summary.bidCount} bid${summary.bidCount === 1 ? "" : "s"}`;
  }
  return `${fmt(min)}–${fmt(max)} · ${summary.bidCount} bids`;
}
