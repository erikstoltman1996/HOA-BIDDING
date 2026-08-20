"use client";

import { useState, useTransition } from "react";
import { addResident, removeResident, resendResidentInvite } from "@/app/community/actions";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { ClipboardCopy, Mail, UserPlus, X } from "@/components/bid-ledger/icons";

export interface ResidentRow {
  id: string;
  unit_label: string;
  contact_email: string | null;
  access_token: string;
}

export function ResidentRoster({ residents }: { residents: ResidentRow[] }) {
  const [unitLabel, setUnitLabel] = useState("");
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyLink(residentId: string, token: string) {
    const url = `${window.location.origin}/vote/${token}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedId(residentId);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await addResident(unitLabel, email);
        setUnitLabel("");
        setEmail("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add resident");
      }
    });
  }

  return (
    <div className="mb-6 rounded border border-rule bg-paper-card shadow-card p-3">
      <div className="mb-2 text-xs font-medium text-ink-soft">Residents</div>
      <ul className="mb-3 space-y-1">
        {residents.map((r) => (
          <li key={r.id} className="flex items-center justify-between text-sm">
            <span className="text-ink">
              {r.unit_label} {r.contact_email && <span className="text-ink-soft">· {r.contact_email}</span>}
            </span>
            <span className="flex items-center gap-2">
              <button
                onClick={() => copyLink(r.id, r.access_token)}
                className="flex items-center gap-1 text-xs text-ink-soft hover:text-ink"
              >
                <ClipboardCopy size={12} /> {copiedId === r.id ? "Copied" : "Copy link"}
              </button>
              {r.contact_email && (
                <button
                  onClick={() => startTransition(() => resendResidentInvite(r.id))}
                  className="flex items-center gap-1 text-xs text-gold-text hover:opacity-80"
                  disabled={isPending}
                >
                  <Mail size={12} /> Resend
                </button>
              )}
              <button
                onClick={() => startTransition(() => removeResident(r.id))}
                className="text-rule hover:text-ink-soft"
                aria-label={`Remove ${r.unit_label}`}
              >
                <X size={13} />
              </button>
            </span>
          </li>
        ))}
        {residents.length === 0 && <li className="text-xs text-ink-soft">No residents added yet.</li>}
      </ul>
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <Label htmlFor="unit-label">Unit / household</Label>
          <Input
            id="unit-label"
            value={unitLabel}
            onChange={(e) => setUnitLabel(e.target.value)}
            placeholder="Building B, Unit 4"
            required
          />
        </div>
        <div className="min-w-[180px] flex-1">
          <Label htmlFor="resident-email">Email (optional)</Label>
          <Input id="resident-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button type="submit" variant="outline" disabled={isPending}>
          <UserPlus size={14} /> Add
        </Button>
      </form>
      <p className="mt-2 text-xs text-ink-soft">
        No email on file? Add them anyway, then share their personal link however you reach
        residents today — it&apos;s the same link every time.
      </p>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
