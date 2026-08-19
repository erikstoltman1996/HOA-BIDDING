"use client";

import { useTransition } from "react";
import { closePoll } from "@/app/community/actions";
import { Button } from "@/components/ui/Button";

export interface PollOptionRow {
  id: string;
  label: string;
}

export interface PollResponseRow {
  id: string;
  resident_id: string;
  option_id: string | null;
  note: string | null;
}

export interface PollRow {
  id: string;
  question: string;
  description: string | null;
  respond_by: string | null;
  status: "open" | "closed";
  created_at: string;
  options: PollOptionRow[];
  responses: PollResponseRow[];
}

export function PollList({
  polls,
  residentCount,
  isAdmin,
}: {
  polls: PollRow[];
  residentCount: number;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (polls.length === 0) {
    return <p className="text-xs text-ink-soft">No community decisions posted yet.</p>;
  }

  return (
    <div className="space-y-4">
      {polls.map((poll) => {
        const tally = poll.options.map((o) => ({
          ...o,
          count: poll.responses.filter((r) => r.option_id === o.id).length,
        }));
        const topCount = tally.length ? Math.max(...tally.map((t) => t.count)) : 0;
        const responded = poll.responses.length;

        return (
          <div key={poll.id} className="rounded border border-rule bg-paper-card p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-serif text-base text-ink">{poll.question}</span>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  border: `1px solid ${poll.status === "open" ? "#3F6B4E" : "#C8C2B4"}`,
                  color: poll.status === "open" ? "#3F6B4E" : "#5B6578",
                }}
              >
                {poll.status === "open" ? "Open" : "Closed"}
              </span>
            </div>
            {poll.description && <p className="mb-2 text-xs text-ink-soft">{poll.description}</p>}
            <div className="mb-2 text-xs text-ink-soft">
              {responded} of {residentCount} residents responded
              {poll.respond_by ? ` · respond by ${poll.respond_by}` : ""}
            </div>

            <div className="mb-2 flex flex-wrap gap-2">
              {tally.map((t) => (
                <span
                  key={t.id}
                  className="rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{
                    border: `1px solid ${t.count > 0 && t.count === topCount ? "#B8863B" : "#C8C2B4"}`,
                    color: t.count > 0 && t.count === topCount ? "#B8863B" : "#5B6578",
                  }}
                >
                  {t.label}: {t.count}
                </span>
              ))}
            </div>

            {isAdmin && poll.status === "open" && (
              <Button
                variant="ghost"
                disabled={isPending}
                onClick={() => startTransition(() => closePoll(poll.id))}
              >
                Close poll
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
