"use server";

import { createAdminClient } from "@/lib/supabase/server";

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB — a soft guard, not a real storage-quota system.

/**
 * Submits a contractor's weekly update, including any photos. Runs entirely
 * server-side with the service-role client — the contractor never has a
 * Supabase Auth session, so this is the only path that can write to
 * weekly_updates/photos. The token is the sole authorization check.
 */
export async function submitContractorUpdate(token: string, formData: FormData) {
  const supabase = createAdminClient();

  const { data: contractor, error: contractorError } = await supabase
    .from("contractors")
    .select("id, project_id")
    .eq("access_token", token)
    .maybeSingle();
  if (contractorError) throw new Error(contractorError.message);
  if (!contractor) throw new Error("Invalid or expired link");

  const percentComplete = Number(formData.get("percent_complete") ?? 0);
  const timelineStatus = String(formData.get("timeline_status") ?? "on_track");
  const issuesText = String(formData.get("issues_text") ?? "").trim();
  const nextMilestoneDate = String(formData.get("next_milestone_date") ?? "").trim();

  if (!["on_track", "ahead", "delayed"].includes(timelineStatus)) {
    throw new Error("Invalid status");
  }

  const { data: update, error: updateError } = await supabase
    .from("weekly_updates")
    .insert({
      project_id: contractor.project_id,
      contractor_id: contractor.id,
      percent_complete: Math.min(100, Math.max(0, percentComplete)),
      timeline_status: timelineStatus as "on_track" | "ahead" | "delayed",
      issues_text: issuesText || null,
      next_milestone_date: nextMilestoneDate || null,
    })
    .select()
    .single();
  if (updateError) throw new Error(updateError.message);

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_PHOTOS);

  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) continue;

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${contractor.project_id}/${update.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("weekly-update-photos")
      .upload(path, file, { contentType: file.type || "image/jpeg" });
    if (uploadError) continue; // don't fail the whole update over one bad photo

    const {
      data: { publicUrl },
    } = supabase.storage.from("weekly-update-photos").getPublicUrl(path);

    await supabase.from("photos").insert({ update_id: update.id, url: publicUrl });
  }
}
