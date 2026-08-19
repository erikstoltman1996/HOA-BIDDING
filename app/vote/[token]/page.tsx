import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { CheckinDisclaimer } from "@/components/checkin/CheckinDisclaimer";
import { VoteForm } from "@/components/community/VoteForm";

export default async function VotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: resident } = await supabase
    .from("residents")
    .select("*, organizations(name)")
    .eq("access_token", token)
    .maybeSingle();

  if (!resident) notFound();

  const orgName = (resident as unknown as { organizations: { name: string } }).organizations?.name || "";

  const { data: polls } = await supabase
    .from("board_polls")
    .select("*")
    .eq("org_id", resident.org_id)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  const pollIds = (polls ?? []).map((p) => p.id);
  const [{ data: options }, { data: responses }] = await Promise.all([
    pollIds.length
      ? supabase.from("poll_options").select("*").in("poll_id", pollIds).order("sort_order")
      : Promise.resolve({ data: [] }),
    pollIds.length ? supabase.from("poll_responses").select("*").in("poll_id", pollIds) : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="min-h-screen w-full bg-paper p-4 sm:p-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-1 text-xs uppercase tracking-widest text-ink-soft" style={{ letterSpacing: "0.15em" }}>
          {orgName} · Community Decisions
        </div>
        <h1 className="mb-4 font-serif text-2xl text-ink">{resident.unit_label}</h1>

        <CheckinDisclaimer />

        {(polls ?? []).length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing open to weigh in on right now — check back later.</p>
        ) : (
          <div className="space-y-4">
            {(polls ?? []).map((poll) => {
              const pollOptions = (options ?? []).filter((o) => o.poll_id === poll.id);
              const pollResponses = (responses ?? []).filter((r) => r.poll_id === poll.id);
              const mine = pollResponses.find((r) => r.resident_id === resident.id);
              const tally: Record<string, number> = {};
              pollResponses.forEach((r) => {
                if (r.option_id) tally[r.option_id] = (tally[r.option_id] ?? 0) + 1;
              });

              return (
                <VoteForm
                  key={poll.id}
                  token={token}
                  pollId={poll.id}
                  question={poll.question}
                  description={poll.description}
                  respondBy={poll.respond_by}
                  options={pollOptions.map((o) => ({ id: o.id, label: o.label }))}
                  initialOptionId={mine?.option_id ?? null}
                  initialNote={mine?.note ?? null}
                  responseCount={tally}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
