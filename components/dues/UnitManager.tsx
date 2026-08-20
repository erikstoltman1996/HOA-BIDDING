"use client";

import { useState, useTransition } from "react";
import { addUnit, removeUnit } from "@/app/dues/actions";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { fmt } from "@/lib/money";
import { Plus, X } from "@/components/bid-ledger/icons";

export interface UnitRow {
  id: string;
  label: string;
  owner_name: string;
  owner_email: string | null;
  monthly_dues_amount: number;
}

export function UnitManager({ units }: { units: UnitRow[] }) {
  const [label, setLabel] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsedAmount = Number(amount);
    if (!(parsedAmount >= 0)) {
      setError("Monthly dues amount must be a number >= 0.");
      return;
    }
    startTransition(() => {
      addUnit(label, ownerName, ownerEmail, parsedAmount);
    });
    setLabel("");
    setOwnerName("");
    setOwnerEmail("");
    setAmount("");
  }

  return (
    <div className="mb-6 rounded border border-rule bg-paper-card shadow-card p-3">
      <div className="mb-2 text-xs font-medium text-ink-soft">Units</div>
      <ul className="mb-3 space-y-1">
        {units.map((u) => (
          <li key={u.id} className="flex items-center justify-between text-sm">
            <span className="text-ink">
              {u.label} <span className="text-ink-soft">· {u.owner_name}</span>
              {u.owner_email && <span className="text-ink-soft"> · {u.owner_email}</span>}
              <span className="font-mono text-ink-soft"> · {fmt(u.monthly_dues_amount)}/mo</span>
            </span>
            <button
              onClick={() => startTransition(() => removeUnit(u.id))}
              className="text-rule hover:text-ink-soft"
              aria-label={`Remove ${u.label}`}
            >
              <X size={13} />
            </button>
          </li>
        ))}
        {units.length === 0 && <li className="text-xs text-ink-soft">No units added yet.</li>}
      </ul>
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[140px] flex-1">
          <Label htmlFor="unit-label">Unit</Label>
          <Input id="unit-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Building A, Unit 1" required />
        </div>
        <div className="min-w-[140px] flex-1">
          <Label htmlFor="unit-owner">Owner name</Label>
          <Input id="unit-owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
        </div>
        <div className="min-w-[160px] flex-1">
          <Label htmlFor="unit-email">Owner email (optional)</Label>
          <Input id="unit-email" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
        </div>
        <div className="w-32">
          <Label htmlFor="unit-amount">Monthly dues</Label>
          <Input
            id="unit-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="font-mono"
            required
          />
        </div>
        <Button type="submit" variant="outline" disabled={isPending}>
          <Plus size={14} /> Add
        </Button>
      </form>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
