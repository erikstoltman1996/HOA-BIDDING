"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Check } from "@/components/bid-ledger/icons";

export interface VoteFormOption {
  id: string;
  label: string;
}

export function VoteForm({
  token,
  pollId,
  question,
  description,
  respondBy,
  options,
  initialOptionId,
  initialNote,
  responseCount,
}: {
  token: string;
  pollId: string;
  question: string;
  description: string | null;
  respondBy: string | null;
  options: VoteFormOption[];
  initialOptionId: string | null;
  initialNote: string | null;
  /** Aggregate counts per option, shown after this resident has voted. */
  responseCount: Record<string, number>;
}) {
  const [optionId, setOptionId] = useState(initialOptionId ?? "");
  const [note, setNote] = useState(initialNote ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    initialOptionId ? "done" : "idle",
  );
  const [error, setError] = useState("");
  const [tally, setTally] = useState(responseCount);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("record_poll_response_by_token", {
      p_token: token,
      p_poll_id: pollId,
      p_option_id: optionId || null,
      p_note: note || null,
    });
    if (rpcError) {
      setStatus("error");
      setError(rpcError.message);
      return;
    }
    // Optimistically bump the tally for display.
    setTally((t) => ({ ...t, [optionId]: (t[optionId] ?? 0) + (initialOptionId === optionId ? 0 : 1) }));
    setStatus("done");
  }

  const totalResponses = Object.values(tally).reduce((a, b) => a + b, 0);

  return (
    <div className="rounded border border-rule bg-paper-card shadow-card p-4">
      <h2 className="mb-1 font-serif text-lg text-ink">{question}</h2>
      {description && <p className="mb-2 text-sm text-ink-soft">{description}</p>}
      {respondBy && <p className="mb-3 text-xs text-ink-soft">Respond by {respondBy}</p>}

      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-2">
          {options.map((opt) => (
            <label
              key={opt.id}
              className="flex items-center justify-between rounded border p-2.5 text-sm"
              style={{ borderColor: optionId === opt.id ? "#B8863B" : "#C8C2B4" }}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`poll-${pollId}`}
                  value={opt.id}
                  checked={optionId === opt.id}
                  onChange={() => setOptionId(opt.id)}
                />
                <span className="text-ink">{opt.label}</span>
              </span>
              {status === "done" && (
                <span className="text-xs text-ink-soft">
                  {tally[opt.id] ?? 0} of {totalResponses}
                </span>
              )}
            </label>
          ))}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Any thoughts (optional)…"
          className="w-full rounded border border-rule bg-paper-card p-2 text-xs text-ink outline-none focus:border-ink"
        />

        {error && <p className="text-xs text-danger">{error}</p>}

        <Button type="submit" disabled={status === "saving" || !optionId} className="w-full">
          {status === "done" ? (
            <>
              <Check size={14} /> Saved — you can change your answer anytime
            </>
          ) : status === "saving" ? (
            "Saving…"
          ) : (
            "Submit my answer"
          )}
        </Button>
      </form>
    </div>
  );
}
