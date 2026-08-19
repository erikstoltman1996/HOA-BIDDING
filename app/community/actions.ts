"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { sendResidentInviteEmail } from "@/lib/email/resend";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

// --- Residents --------------------------------------------------------

export async function addResident(unitLabel: string, email: string) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: resident, error } = await supabase
    .from("residents")
    .insert({ org_id: admin.org_id!, unit_label: unitLabel, contact_email: email || null })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (email) {
    const { data: org } = await supabase.from("organizations").select("name").eq("id", admin.org_id!).single();
    await sendResidentInviteEmail({
      to: email,
      unitLabel,
      orgName: org?.name || "",
      voteUrl: `${siteUrl()}/vote/${resident.access_token}`,
    });
  }

  revalidatePath("/community");
}

export async function removeResident(residentId: string) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("residents")
    .delete()
    .eq("id", residentId)
    .eq("org_id", admin.org_id!);
  if (error) throw new Error(error.message);
  revalidatePath("/community");
}

export async function resendResidentInvite(residentId: string) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: resident } = await supabase.from("residents").select("*").eq("id", residentId).single();
  if (!resident) throw new Error("Resident not found");
  if (!resident.contact_email) throw new Error("This resident has no email on file");

  const { data: org } = await supabase.from("organizations").select("name").eq("id", admin.org_id!).single();
  await sendResidentInviteEmail({
    to: resident.contact_email,
    unitLabel: resident.unit_label,
    orgName: org?.name || "",
    voteUrl: `${siteUrl()}/vote/${resident.access_token}`,
  });
}

// --- Polls --------------------------------------------------------------

export async function createPoll(
  question: string,
  description: string,
  respondBy: string | null,
  options: string[],
) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  if (cleanOptions.length < 2) throw new Error("A poll needs at least two options");

  const { data: poll, error } = await supabase
    .from("board_polls")
    .insert({
      org_id: admin.org_id!,
      question,
      description: description || null,
      respond_by: respondBy,
      created_by: admin.id,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const { error: optionsError } = await supabase.from("poll_options").insert(
    cleanOptions.map((label, i) => ({ poll_id: poll.id, label, sort_order: i })),
  );
  if (optionsError) throw new Error(optionsError.message);

  revalidatePath("/community");
}

export async function closePoll(pollId: string) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("board_polls")
    .update({ status: "closed" })
    .eq("id", pollId)
    .eq("org_id", admin.org_id!);
  if (error) throw new Error(error.message);
  revalidatePath("/community");
}
