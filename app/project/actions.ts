"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { sendCheckinEmail } from "@/lib/email/resend";
import { fmt, money } from "@/lib/money";
import type { Database } from "@/types/database";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

// --- Project ----------------------------------------------------------

export async function updateProjectTitle(projectId: string, title: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ title }).eq("id", projectId);
  if (error) throw new Error(error.message);
}

// --- Line items ---------------------------------------------------------

export async function addLineItem(projectId: string, sortOrder: number) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("line_items")
    .insert({ project_id: projectId, label: "", sort_order: sortOrder })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/project");
  return data;
}

export async function removeLineItem(itemId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("line_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/project");
}

export async function updateLineItemLabel(itemId: string, label: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("line_items").update({ label }).eq("id", itemId);
  if (error) throw new Error(error.message);
}

// --- Bids -----------------------------------------------------------------

export async function addBid(projectId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bids")
    .insert({ project_id: projectId, vendor_name: "" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/project");
  return data;
}

export async function removeBid(bidId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("bids").delete().eq("id", bidId);
  if (error) throw new Error(error.message);
  revalidatePath("/project");
}

type BidField = "vendor_name" | "vendor_contact" | "warranty_years" | "timeline_weeks" | "notes";

export async function updateBidField(bidId: string, field: BidField, value: string) {
  await requireAdmin();
  const supabase = await createClient();

  let update: Partial<Database["public"]["Tables"]["bids"]["Update"]>;
  switch (field) {
    case "warranty_years":
    case "timeline_weeks":
      update = { [field]: value === "" ? null : Number(value) };
      break;
    case "vendor_name":
    case "vendor_contact":
    case "notes":
      update = { [field]: value };
      break;
  }

  const { error } = await supabase.from("bids").update(update).eq("id", bidId);
  if (error) throw new Error(error.message);
}

export async function upsertBidAmount(bidId: string, lineItemId: string, amount: string) {
  await requireAdmin();
  const supabase = await createClient();
  const parsed = amount === "" ? null : Number(amount);
  const { error } = await supabase
    .from("bid_line_item_amounts")
    .upsert(
      { bid_id: bidId, line_item_id: lineItemId, amount: parsed },
      { onConflict: "bid_id,line_item_id" },
    );
  if (error) throw new Error(error.message);
}

// --- Board roster -----------------------------------------------------

export async function inviteBoardMember(name: string, email: string) {
  const admin = await requireAdmin();
  const adminClient = createAdminClient();

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback`,
    data: { name },
  });
  if (inviteError) throw new Error(inviteError.message);

  const { error: insertError } = await adminClient.from("users").insert({
    id: invited.user.id,
    org_id: admin.org_id,
    email,
    name,
    role: "board_member",
  });
  if (insertError) throw new Error(insertError.message);

  revalidatePath("/project");
}

export async function removeBoardMember(userId: string) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ org_id: null })
    .eq("id", userId)
    .eq("org_id", admin.org_id!);
  if (error) throw new Error(error.message);
  revalidatePath("/project");
}

// --- Board check-in -----------------------------------------------------

export async function sendBoardCheckin(
  projectId: string,
  respondBy: string | null,
  recipientIds: string[],
) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .single();
  const { data: org } = await supabase.from("organizations").select("name").eq("id", admin.org_id!).single();

  const { data: bids } = await supabase.from("bids").select("*").eq("project_id", projectId);
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

  const { data: recipients } = await supabase
    .from("users")
    .select("id, name, email")
    .in("id", recipientIds);

  const { data: checkin, error: checkinError } = await supabase
    .from("board_checkins")
    .insert({ project_id: projectId, respond_by: respondBy, created_by: admin.id })
    .select()
    .single();
  if (checkinError) throw new Error(checkinError.message);

  const responseRows = (recipients ?? []).map((r) => ({
    checkin_id: checkin.id,
    board_member_id: r.id,
    name: r.name,
    email: r.email,
  }));
  const { data: responses, error: responsesError } = await supabase
    .from("checkin_responses")
    .insert(responseRows)
    .select();
  if (responsesError) throw new Error(responsesError.message);

  const bidSummaries = (bids ?? []).map((b, i) => ({
    vendor: b.vendor_name || "(unnamed vendor)",
    total: fmt(totals[i]),
    isLowest: totals[i] !== null && totals[i] === lowest,
    warranty: b.warranty_years ? `${b.warranty_years} yr` : "—",
    timeline: b.timeline_weeks ? `${b.timeline_weeks} wk` : "—",
  }));

  await Promise.all(
    (responses ?? []).map((r) =>
      sendCheckinEmail({
        to: r.email,
        recipientName: r.name,
        projectTitle: project?.title || "Bid Comparison",
        orgName: org?.name || "",
        respondBy,
        bids: bidSummaries,
        responseUrl: `${siteUrl()}/checkin/${r.token}`,
      }),
    ),
  );

  revalidatePath("/project");
}

export async function resendCheckinReminders(checkinId: string) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: checkin } = await supabase
    .from("board_checkins")
    .select("*, projects(title, org_id)")
    .eq("id", checkinId)
    .single();
  if (!checkin) throw new Error("Check-in not found");

  const { data: org } = await supabase.from("organizations").select("name").eq("id", admin.org_id!).single();
  const { data: pending } = await supabase
    .from("checkin_responses")
    .select("*")
    .eq("checkin_id", checkinId)
    .is("responded_at", null);

  const { data: bids } = await supabase
    .from("bids")
    .select("*")
    .eq("project_id", checkin.project_id);
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
    vendor: b.vendor_name || "(unnamed vendor)",
    total: fmt(totals[i]),
    isLowest: totals[i] !== null && totals[i] === lowest,
    warranty: b.warranty_years ? `${b.warranty_years} yr` : "—",
    timeline: b.timeline_weeks ? `${b.timeline_weeks} wk` : "—",
  }));

  const projectTitle = (checkin as unknown as { projects: { title: string } }).projects?.title || "Bid Comparison";

  await Promise.all(
    (pending ?? []).map((r) =>
      sendCheckinEmail({
        to: r.email,
        recipientName: r.name,
        projectTitle,
        orgName: org?.name || "",
        respondBy: checkin.respond_by,
        bids: bidSummaries,
        responseUrl: `${siteUrl()}/checkin/${r.token}`,
      }),
    ),
  );
}
