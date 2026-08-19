import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ResidentRoster } from "@/components/community/ResidentRoster";
import { PollCreateForm } from "@/components/community/PollCreateForm";
import { PollList, type PollRow } from "@/components/community/PollList";
import { AppHeader } from "@/components/AppHeader";
import { SectionNav } from "@/components/SectionNav";

export default async function CommunityPage() {
  const { authUser, profile } = await requireUser();
  const supabase = await createClient();

  if (!profile.org_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-8 text-center">
        <p className="text-sm text-ink-soft">Your account isn&apos;t linked to an HOA yet.</p>
      </div>
    );
  }

  const [{ data: org }, { data: residents }, { data: pollsRaw }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", profile.org_id).single(),
    supabase.from("residents").select("*").eq("org_id", profile.org_id).order("unit_label"),
    supabase.from("board_polls").select("*").eq("org_id", profile.org_id).order("created_at", { ascending: false }),
  ]);

  const pollIds = (pollsRaw ?? []).map((p) => p.id);
  const [{ data: options }, { data: responses }] = await Promise.all([
    pollIds.length
      ? supabase.from("poll_options").select("*").in("poll_id", pollIds).order("sort_order")
      : Promise.resolve({ data: [] }),
    pollIds.length
      ? supabase.from("poll_responses").select("*").in("poll_id", pollIds)
      : Promise.resolve({ data: [] }),
  ]);

  const polls: PollRow[] = (pollsRaw ?? []).map((p) => ({
    id: p.id,
    question: p.question,
    description: p.description,
    respond_by: p.respond_by,
    status: p.status,
    created_at: p.created_at,
    options: (options ?? [])
      .filter((o) => o.poll_id === p.id)
      .map((o) => ({ id: o.id, label: o.label })),
    responses: (responses ?? [])
      .filter((r) => r.poll_id === p.id)
      .map((r) => ({ id: r.id, resident_id: r.resident_id, option_id: r.option_id, note: r.note })),
  }));

  const isAdmin = profile.role === "admin";

  return (
    <div className="min-h-screen w-full">
      <AppHeader
        orgName={org?.name ?? ""}
        userLabel={`${profile.name || authUser.email} · ${profile.role.replace("_", " ")}`}
        section="Community"
        maxWidthClassName="max-w-3xl"
      />
      <div className="mx-auto max-w-3xl p-4 sm:p-8">
        <SectionNav current="/community" />

        <div className="mb-6 border-b-2 border-ink pb-4">
          <h1 className="font-serif text-2xl text-ink sm:text-3xl">Residents &amp; Community Decisions</h1>
        </div>

        {isAdmin && (
          <>
            <ResidentRoster residents={residents ?? []} />
            <PollCreateForm />
          </>
        )}

        <h2 className="mb-2 mt-4 font-serif text-lg font-semibold text-ink">Community decisions</h2>
        <PollList polls={polls} residentCount={residents?.length ?? 0} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
