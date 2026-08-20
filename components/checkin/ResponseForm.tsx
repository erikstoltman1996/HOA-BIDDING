"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { CheckinDisclaimer } from "@/components/checkin/CheckinDisclaimer";
import { Check } from "@/components/bid-ledger/icons";

export interface ResponseFormBid {
  id: string;
  vendor: string;
  total: string;
  isLowest: boolean;
}

export function ResponseForm({
  token,
  projectTitle,
  bids,
  initialPickBidId,
  initialNote,
  alreadyResponded,
  compact = false,
}: {
  token: string;
  projectTitle: string;
  bids: ResponseFormBid[];
  initialPickBidId: string | null;
  initialNote: string | null;
  alreadyResponded: boolean;
  /** Hide the heading + disclaimer when embedded inside a page that already shows them. */
  compact?: boolean;
}) {
  const [pick, setPick] = useState(initialPickBidId ?? "");
  const [note, setNote] = useState(initialNote ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    alreadyResponded ? "done" : "idle",
  );
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("record_checkin_response_by_token", {
      p_token: token,
      p_pick_bid_id: pick || null,
      p_note: note || null,
    });
    if (rpcError) {
      setStatus("error");
      setError(rpcError.message);
      return;
    }
    setStatus("done");
  }

  return (
    <div>
      {!compact && (
        <>
          <div className="mb-1 text-xs uppercase tracking-widest text-ink-soft" style={{ letterSpacing: "0.15em" }}>
            Board Check-In
          </div>
          <h1 className="mb-4 font-serif text-2xl text-ink">{projectTitle}</h1>
          <CheckinDisclaimer />
        </>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-ink-soft">Your pick</label>
          <div className="space-y-2">
            {bids.map((b) => (
              <label
                key={b.id}
                className="flex items-center justify-between rounded border p-3 text-sm"
                style={{ borderColor: pick === b.id ? "#B8863B" : "#C8C2B4" }}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pick"
                    value={b.id}
                    checked={pick === b.id}
                    onChange={() => setPick(b.id)}
                  />
                  <span className="font-serif text-ink">
                    {b.vendor}
                    {b.isLowest && " — lowest total"}
                  </span>
                </span>
                <span className="font-mono text-ink-soft">{b.total}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="note" className="mb-1 block text-xs text-ink-soft">
            Concerns or notes (optional)
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded border border-rule bg-paper-card p-2 text-sm text-ink outline-none focus:border-ink"
            placeholder="Any conditions or concerns…"
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <Button type="submit" className="w-full" disabled={status === "saving" || !pick}>
          {status === "done" ? (
            <>
              <Check size={14} /> Saved — you can update this anytime
            </>
          ) : status === "saving" ? (
            "Saving…"
          ) : (
            "Submit my pick"
          )}
        </Button>
      </form>
    </div>
  );
}
