"use client";

import { useState, useTransition } from "react";
import { createPoll } from "@/app/community/actions";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Plus, Send, X } from "@/components/bid-ledger/icons";

export function PollCreateForm() {
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [respondBy, setRespondBy] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  function updateOption(i: number, value: string) {
    setOptions((opts) => opts.map((o, idx) => (idx === i ? value : o)));
  }

  function addOption() {
    if (options.length >= 6) return;
    setOptions((opts) => [...opts, ""]);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions((opts) => opts.filter((_, idx) => idx !== i));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("idle");
    setError("");
    startTransition(async () => {
      try {
        await createPoll(question, description, respondBy || null, options);
        setQuestion("");
        setDescription("");
        setRespondBy("");
        setOptions(["", ""]);
        setStatus("sent");
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not create poll");
      }
    });
  }

  return (
    <div className="mb-6 rounded border border-rule bg-paper-card shadow-card p-3">
      <div className="mb-2 text-xs font-medium text-ink-soft">Ask the community a question</div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="poll-question">Question</Label>
          <Input
            id="poll-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Should we use this year's funds to upgrade the pool or fix Building B decks?"
            required
          />
        </div>
        <div>
          <Label htmlFor="poll-description">Context (optional)</Label>
          <textarea
            id="poll-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded border border-rule bg-paper-card p-2 text-sm text-ink outline-none focus:border-ink"
            placeholder="A sentence or two of background residents should know before answering…"
          />
        </div>
        <div>
          <Label htmlFor="poll-respond-by">Response requested by (optional)</Label>
          <Input
            id="poll-respond-by"
            type="date"
            value={respondBy}
            onChange={(e) => setRespondBy(e.target.value)}
            className="w-auto"
          />
        </div>
        <div>
          <Label htmlFor="poll-option-0">Options</Label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input
                  id={`poll-option-${i}`}
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  required
                />
                {options.length > 2 && (
                  <button type="button" onClick={() => removeOption(i)} className="text-rule hover:text-ink-soft">
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 6 && (
            <button
              type="button"
              onClick={addOption}
              className="mt-2 flex items-center gap-1 text-xs text-ink-soft hover:text-ink"
            >
              <Plus size={12} /> Add option
            </button>
          )}
        </div>

        {error && <p className="text-xs text-red-700">{error}</p>}

        <Button type="submit" disabled={isPending}>
          <Send size={14} /> {isPending ? "Publishing…" : "Publish poll"}
        </Button>
        <p className="text-xs text-ink-soft">
          Residents will see this next time they open their link. This doesn&apos;t send a new
          email — if you want to prompt them now, use each resident&apos;s &quot;Resend&quot; button below.
        </p>
        {status === "sent" && <p className="mt-2 text-xs text-check-green">Published.</p>}
      </form>
    </div>
  );
}
