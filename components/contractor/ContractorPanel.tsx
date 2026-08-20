"use client";

import { useState, useTransition } from "react";
import {
  addContractor,
  removeContractor,
  sendContractorReminder,
} from "@/app/project/actions";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { ChevronRight, Mail, UserPlus, X } from "@/components/bid-ledger/icons";

export interface ContractorRow {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
}

export interface PhotoRow {
  id: string;
  url: string;
  caption: string | null;
}

export interface WeeklyUpdateRow {
  id: string;
  contractor_id: string;
  week_of: string;
  percent_complete: number;
  timeline_status: "on_track" | "ahead" | "delayed";
  issues_text: string | null;
  next_milestone_date: string | null;
  created_at: string;
  photos: PhotoRow[];
}

const STATUS_LABEL: Record<WeeklyUpdateRow["timeline_status"], string> = {
  on_track: "On track",
  ahead: "Ahead of schedule",
  delayed: "Delayed",
};

const STATUS_COLOR: Record<WeeklyUpdateRow["timeline_status"], string> = {
  on_track: "#3F6B4E",
  ahead: "#3F6B4E",
  // Gold darkened for text — see --color-gold-text in globals.css.
  delayed: "#83602A",
};

const STALE_DAYS = 8;

export function ContractorPanel({
  projectId,
  isAdmin,
  contractors,
  updates,
  now,
}: {
  projectId: string;
  isAdmin: boolean;
  contractors: ContractorRow[];
  updates: WeeklyUpdateRow[];
  /** Current time in ms, computed once server-side (page.tsx) so the client
   *  component never has to call the impure Date.now() itself. */
  now: number;
}) {
  return (
    <div className="mt-10 border-t-2 border-ink pt-6">
      <h2 className="mb-4 font-serif text-lg font-semibold text-ink">Contractor Updates</h2>

      {isAdmin && (
        <details className="group mb-6">
          <summary className="flex cursor-pointer select-none items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink">
            <ChevronRight size={14} className="transition-transform group-open:rotate-90" />
            Manage contractors
          </summary>
          <div className="mt-2">
            <ContractorRoster projectId={projectId} contractors={contractors} />
          </div>
        </details>
      )}

      {contractors.length === 0 ? (
        <p className="text-xs text-ink-soft">No contractor added yet — add one once a bid is awarded.</p>
      ) : (
        <div className="space-y-4">
          {contractors.map((c) => (
            <ContractorTimeline
              key={c.id}
              now={now}
              contractor={c}
              updates={updates.filter((u) => u.contractor_id === c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ContractorRoster({
  projectId,
  contractors,
}: {
  projectId: string;
  contractors: ContractorRow[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await addContractor(projectId, name, email, phone);
        setName("");
        setEmail("");
        setPhone("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add contractor");
      }
    });
  }

  return (
    <div className="mb-6 rounded border border-rule bg-paper-card shadow-card p-3">
      <div className="mb-2 text-xs font-medium text-ink-soft">Contractors on this project</div>
      <ul className="mb-3 space-y-1">
        {contractors.map((c) => (
          <li key={c.id} className="flex items-center justify-between text-sm">
            <span className="text-ink">
              {c.name}{" "}
              {c.contact_email && <span className="text-ink-soft">· {c.contact_email}</span>}
            </span>
            <span className="flex items-center gap-2">
              {c.contact_email && (
                <button
                  onClick={() => startTransition(() => sendContractorReminder(c.id))}
                  className="flex items-center gap-1 text-xs text-gold-text hover:opacity-80"
                  disabled={isPending}
                >
                  <Mail size={12} /> Remind
                </button>
              )}
              <button
                onClick={() => startTransition(() => removeContractor(c.id))}
                className="text-rule hover:text-ink-soft"
                aria-label={`Remove ${c.name}`}
              >
                <X size={13} />
              </button>
            </span>
          </li>
        ))}
        {contractors.length === 0 && <li className="text-xs text-ink-soft">None added yet.</li>}
      </ul>
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[120px] flex-1">
          <Label htmlFor="contractor-name">Name</Label>
          <Input id="contractor-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="min-w-[160px] flex-1">
          <Label htmlFor="contractor-email">Email</Label>
          <Input id="contractor-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="min-w-[120px] flex-1">
          <Label htmlFor="contractor-phone">Phone</Label>
          <Input id="contractor-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button type="submit" variant="outline" disabled={isPending}>
          <UserPlus size={14} /> Add
        </Button>
      </form>
      <p className="mt-2 text-xs text-ink-soft">
        Adding an email sends them their update link right away. No email? Add them anyway and copy
        their link later from the roster.
      </p>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

function ContractorTimeline({
  contractor,
  updates,
  now,
}: {
  contractor: ContractorRow;
  updates: WeeklyUpdateRow[];
  now: number;
}) {
  const sorted = [...updates].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const latest = sorted[0];

  const hasNoUpdates = !latest;
  const daysSince = latest
    ? Math.floor((now - new Date(latest.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isStale = hasNoUpdates || (daysSince !== null && daysSince > STALE_DAYS);

  return (
    <div className="rounded border border-rule bg-paper-card shadow-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-serif text-base text-ink">{contractor.name}</span>
        {isStale && (
          <span className="rounded-full border border-gold px-2 py-0.5 text-xs font-medium text-gold-text">
            {hasNoUpdates ? "No updates yet" : `No update in ${daysSince} days`}
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-ink-soft">Waiting on their first weekly update.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((u) => (
            <li key={u.id} className="border-t border-rule pt-3 first:border-t-0 first:pt-0">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-ink">{u.percent_complete}% complete</span>
                <span style={{ color: STATUS_COLOR[u.timeline_status] }} className="font-medium">
                  {STATUS_LABEL[u.timeline_status]}
                </span>
                <span className="text-ink-soft">· {new Date(u.created_at).toLocaleDateString()}</span>
                {u.next_milestone_date && (
                  <span className="text-ink-soft">
                    · Next milestone {new Date(u.next_milestone_date).toLocaleDateString()}
                  </span>
                )}
              </div>
              {u.issues_text && <p className="mb-2 text-xs text-ink-soft">{u.issues_text}</p>}
              {u.photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {u.photos.map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={p.id}
                      src={p.url}
                      alt={p.caption || "Progress photo"}
                      className="h-20 w-20 rounded object-cover"
                    />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
