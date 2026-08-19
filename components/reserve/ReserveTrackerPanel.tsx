"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addReserveAsset,
  removeReserveAsset,
  updateReserveSettings,
} from "@/app/reserve/actions";
import {
  ReserveTrackerService,
  type CommunityAsset,
  type YearOutlook,
} from "@/lib/ReserveTrackerService";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { fmt } from "@/lib/money";
import { Plus, X } from "@/components/bid-ledger/icons";

export interface ReserveAssetRow {
  id: string;
  name: string;
  expected_lifespan_years: number;
  replacement_cost: number;
  current_age_years: number;
}

const ALERT_THRESHOLD = 70;

export function ReserveTrackerPanel({
  isAdmin,
  initialBalance,
  initialContribution,
  initialAssets,
}: {
  isAdmin: boolean;
  initialBalance: number;
  initialContribution: number;
  initialAssets: ReserveAssetRow[];
}) {
  const [balance, setBalance] = useState(String(initialBalance));
  const [contribution, setContribution] = useState(String(initialContribution));
  const [isPending, startTransition] = useTransition();

  const [expDescription, setExpDescription] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expYear, setExpYear] = useState("0");
  const [expAssetId, setExpAssetId] = useState("");

  function saveSettings(nextBalance: string, nextContribution: string) {
    const b = Number(nextBalance);
    const c = Number(nextContribution);
    if (Number.isFinite(b) && Number.isFinite(c)) {
      startTransition(() => updateReserveSettings(b, c));
    }
  }

  const assets: CommunityAsset[] = initialAssets.map((a) => ({
    id: a.id,
    name: a.name,
    expectedLifespanYears: a.expected_lifespan_years,
    replacementCost: a.replacement_cost,
    currentAgeYears: a.current_age_years,
  }));

  const result = useMemo(() => {
    const b = Number(balance);
    const c = Number(contribution);
    const amount = Number(expAmount);
    if (!Number.isFinite(b) || !Number.isFinite(c)) return null;
    try {
      const service = new ReserveTrackerService({ alertThresholdPercent: ALERT_THRESHOLD });
      return service.calculate({
        currentReserveBalance: b,
        annualContribution: c,
        assets,
        newExpenditure: {
          description: expDescription,
          amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
          yearIndex: Math.max(0, Number(expYear) || 0),
          assetId: expAssetId || undefined,
        },
      });
    } catch {
      return null;
    }
  }, [balance, contribution, assets, expDescription, expAmount, expYear, expAssetId]);

  return (
    <div>
      <div className="mb-6 border-b-2 border-ink pb-4">
        <div className="mb-2 text-xs uppercase tracking-widest text-ink-soft" style={{ letterSpacing: "0.15em" }}>
          Bid Ledger · Reserve Fund
        </div>
        <h1 className="font-serif text-2xl text-ink sm:text-3xl">10-Year Reserve Outlook</h1>
      </div>

      <div className="mb-6 flex flex-wrap gap-6 rounded border border-rule bg-paper-card p-3">
        <div>
          <Label htmlFor="reserve-balance">Current reserve balance</Label>
          {isAdmin ? (
            <Input
              id="reserve-balance"
              inputMode="decimal"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              onBlur={(e) => saveSettings(e.target.value, contribution)}
              className="w-40 font-mono"
            />
          ) : (
            <p className="font-mono text-ink">{fmt(Number(balance))}</p>
          )}
        </div>
        <div>
          <Label htmlFor="reserve-contribution">Planned annual contribution</Label>
          {isAdmin ? (
            <Input
              id="reserve-contribution"
              inputMode="decimal"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              onBlur={(e) => saveSettings(balance, e.target.value)}
              className="w-40 font-mono"
            />
          ) : (
            <p className="font-mono text-ink">{fmt(Number(contribution))}</p>
          )}
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-ink-soft">Funded today</div>
          <p className="font-mono text-ink">
            {result ? `${result.currentPercentFunded.toFixed(0)}%` : "—"}
          </p>
        </div>
      </div>

      {isAdmin && <AssetManager assets={initialAssets} isPending={isPending} startTransition={startTransition} />}

      <div className="mb-6 rounded border border-rule bg-paper-card p-3">
        <div className="mb-2 text-xs font-medium text-ink-soft">Model an unplanned expenditure</div>
        <p className="mb-3 text-xs text-ink-soft">
          This is a what-if calculator — nothing here is saved. Try a scenario to see how it moves the
          10-year outlook below.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[160px] flex-1">
            <Label htmlFor="exp-description">Description</Label>
            <Input
              id="exp-description"
              value={expDescription}
              onChange={(e) => setExpDescription(e.target.value)}
              placeholder="Early pool pump replacement"
            />
          </div>
          <div className="w-32">
            <Label htmlFor="exp-amount">Amount</Label>
            <Input
              id="exp-amount"
              inputMode="decimal"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              placeholder="0"
              className="font-mono"
            />
          </div>
          <div className="w-24">
            <Label htmlFor="exp-year">In year</Label>
            <Input
              id="exp-year"
              inputMode="numeric"
              value={expYear}
              onChange={(e) => setExpYear(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <Label htmlFor="exp-asset">Linked asset (optional)</Label>
            <select
              id="exp-asset"
              value={expAssetId}
              onChange={(e) => setExpAssetId(e.target.value)}
              className="w-full rounded border border-rule bg-paper-card px-3 py-2 text-sm text-ink outline-none focus:border-ink"
            >
              <option value="">None</option>
              {initialAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {result?.alert && (
        <div className="mb-4 rounded bg-gold-tint p-3 text-sm text-ink">
          <strong>Funding drops below {ALERT_THRESHOLD}%</strong> in year {result.firstAlertYear}{" "}
          of this projection.
        </div>
      )}

      {result && <OutlookTable outlook={result.outlook} />}
    </div>
  );
}

function AssetManager({
  assets,
  isPending,
  startTransition,
}: {
  assets: ReserveAssetRow[];
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [name, setName] = useState("");
  const [lifespan, setLifespan] = useState("");
  const [cost, setCost] = useState("");
  const [age, setAge] = useState("");
  const [error, setError] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const l = Number(lifespan);
    const c = Number(cost);
    const a = Number(age);
    if (!(l > 0) || !(c >= 0) || !(a >= 0)) {
      setError("Lifespan must be > 0; cost and age must be >= 0.");
      return;
    }
    startTransition(() => {
      addReserveAsset(name, l, c, a);
    });
    setName("");
    setLifespan("");
    setCost("");
    setAge("");
  }

  return (
    <div className="mb-6 rounded border border-rule bg-paper-card p-3">
      <div className="mb-2 text-xs font-medium text-ink-soft">Community assets</div>
      <ul className="mb-3 space-y-1">
        {assets.map((a) => (
          <li key={a.id} className="flex items-center justify-between text-sm">
            <span className="text-ink">
              {a.name}{" "}
              <span className="font-mono text-ink-soft">
                · {fmt(a.replacement_cost)} · {a.current_age_years}/{a.expected_lifespan_years} yrs
              </span>
            </span>
            <button
              onClick={() => startTransition(() => removeReserveAsset(a.id))}
              className="text-rule hover:text-ink-soft"
              aria-label={`Remove ${a.name}`}
            >
              <X size={13} />
            </button>
          </li>
        ))}
        {assets.length === 0 && <li className="text-xs text-ink-soft">No assets tracked yet.</li>}
      </ul>
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[140px] flex-1">
          <Label htmlFor="asset-name">Name</Label>
          <Input id="asset-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="w-28">
          <Label htmlFor="asset-lifespan">Lifespan (yrs)</Label>
          <Input
            id="asset-lifespan"
            inputMode="decimal"
            value={lifespan}
            onChange={(e) => setLifespan(e.target.value)}
            className="font-mono"
            required
          />
        </div>
        <div className="w-32">
          <Label htmlFor="asset-cost">Replacement cost</Label>
          <Input
            id="asset-cost"
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="font-mono"
            required
          />
        </div>
        <div className="w-24">
          <Label htmlFor="asset-age">Age (yrs)</Label>
          <Input
            id="asset-age"
            inputMode="decimal"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="font-mono"
            required
          />
        </div>
        <Button type="submit" variant="outline" disabled={isPending}>
          <Plus size={14} /> Add
        </Button>
      </form>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

function OutlookTable({ outlook }: { outlook: YearOutlook[] }) {
  return (
    <div className="overflow-x-auto rounded border border-rule bg-paper-card">
      <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 700 }}>
        <thead>
          <tr>
            {["Year", "Start", "+Contribution", "-Scheduled", "-Unplanned", "End", "Fully funded", "% Funded"].map(
              (h) => (
                <th key={h} className="border-b-2 border-ink p-2 text-left text-xs font-medium text-ink-soft">
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {outlook.map((y) => {
            const isBelowThreshold = y.percentFunded < ALERT_THRESHOLD;
            return (
              <tr key={y.year}>
                <td className="border-t border-rule p-2 font-mono text-ink">{y.year}</td>
                <td className="border-t border-rule p-2 font-mono text-ink-soft">{fmt(y.startingBalance)}</td>
                <td className="border-t border-rule p-2 font-mono text-check-green">
                  {y.contributions > 0 ? `+${fmt(y.contributions)}` : "—"}
                </td>
                <td className="border-t border-rule p-2 font-mono text-ink-soft">
                  {y.scheduledReplacementCost > 0 ? `-${fmt(y.scheduledReplacementCost)}` : "—"}
                </td>
                <td className="border-t border-rule p-2 font-mono text-ink-soft">
                  {y.unplannedExpenditure > 0 ? `-${fmt(y.unplannedExpenditure)}` : "—"}
                </td>
                <td className="border-t border-rule p-2 font-mono font-semibold text-ink">
                  {fmt(y.endingBalance)}
                </td>
                <td className="border-t border-rule p-2 font-mono text-ink-soft">{fmt(y.fullyFundedBalance)}</td>
                <td
                  className="border-t border-rule p-2 font-mono font-semibold"
                  style={{ color: isBelowThreshold ? "#B8863B" : "#3F6B4E" }}
                >
                  {y.percentFunded.toFixed(0)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
