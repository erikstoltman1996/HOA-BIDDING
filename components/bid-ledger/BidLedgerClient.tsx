"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  addBid,
  addLineItem,
  removeBid,
  removeLineItem,
  updateBidField,
  updateLineItemLabel,
  updateProjectTitle,
  upsertBidAmount,
} from "@/app/project/actions";
import { fmt, money } from "@/lib/money";
import { useDebouncedCallback } from "@/lib/useDebouncedCallback";
import { Check, ClipboardCopy, Plus, Stamp, X } from "@/components/bid-ledger/icons";
import { Button } from "@/components/ui/Button";
import { ExportCsvButton } from "@/components/ExportCsvButton";

export interface LineItemRow {
  id: string;
  label: string;
}

export interface BidRow {
  id: string;
  vendor_name: string;
  warranty_years: number | null;
  timeline_weeks: number | null;
  notes: string | null;
  amounts: Record<string, string>; // line_item_id -> amount string
}

export function BidLedgerClient({
  projectId,
  initialTitle,
  initialItems,
  initialBids,
  isAdmin,
  exportCsv,
}: {
  projectId: string;
  initialTitle: string;
  initialItems: LineItemRow[];
  initialBids: BidRow[];
  isAdmin: boolean;
  exportCsv: () => Promise<string>;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [items, setItems] = useState(initialItems);
  const [bids, setBids] = useState(initialBids);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);

  const debouncedSave = useDebouncedCallback((_key: string, fn: () => void) => fn(), 500);

  const totals = useMemo(
    () =>
      bids.map((b) => {
        let sum = 0;
        let hasAny = false;
        items.forEach((it) => {
          const v = money(b.amounts[it.id]);
          if (v !== null) {
            sum += v;
            hasAny = true;
          }
        });
        return hasAny ? sum : null;
      }),
    [bids, items],
  );

  const validTotals = totals.filter((t): t is number => t !== null);
  const lowestTotal = validTotals.length ? Math.min(...validTotals) : null;
  const lowestTotalIdx = lowestTotal !== null ? totals.indexOf(lowestTotal) : -1;

  const warrantyVals = bids.map((b) => b.warranty_years);
  const longestWarranty = warrantyVals.some((v) => v !== null)
    ? Math.max(...(warrantyVals.filter((v): v is number => v !== null)))
    : null;

  const timelineVals = bids.map((b) => b.timeline_weeks);
  const shortestTimeline = timelineVals.some((v) => v !== null)
    ? Math.min(...(timelineVals.filter((v): v is number => v !== null)))
    : null;

  function lowestForItem(itemId: string) {
    const vals = bids.map((b) => money(b.amounts[itemId]));
    const valid = vals.filter((v): v is number => v !== null);
    return valid.length ? Math.min(...valid) : null;
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    debouncedSave("title", () => updateProjectTitle(projectId, value));
  }

  function handleAmountChange(bidId: string, itemId: string, value: string) {
    setBids((bs) =>
      bs.map((b) => (b.id === bidId ? { ...b, amounts: { ...b.amounts, [itemId]: value } } : b)),
    );
    debouncedSave(`amount-${bidId}-${itemId}`, () => upsertBidAmount(bidId, itemId, value));
  }

  function handleBidFieldChange(
    bidId: string,
    field: "vendor_name" | "notes",
    value: string,
  ) {
    setBids((bs) => bs.map((b) => (b.id === bidId ? { ...b, [field]: value } : b)));
    debouncedSave(`${field}-${bidId}`, () => updateBidField(bidId, field, value));
  }

  function handleBidNumberFieldChange(
    bidId: string,
    field: "warranty_years" | "timeline_weeks",
    value: string,
  ) {
    setBids((bs) =>
      bs.map((b) => (b.id === bidId ? { ...b, [field]: value === "" ? null : Number(value) } : b)),
    );
    debouncedSave(`${field}-${bidId}`, () => updateBidField(bidId, field, value));
  }

  function handleItemLabelChange(itemId: string, value: string) {
    setItems((its) => its.map((it) => (it.id === itemId ? { ...it, label: value } : it)));
    debouncedSave(`item-${itemId}`, () => updateLineItemLabel(itemId, value));
  }

  function handleAddItem() {
    startTransition(async () => {
      const row = await addLineItem(projectId, items.length);
      setItems((its) => [...its, { id: row.id, label: row.label }]);
    });
  }

  function handleRemoveItem(itemId: string) {
    setItems((its) => its.filter((it) => it.id !== itemId));
    startTransition(() => removeLineItem(itemId));
  }

  function handleAddBid() {
    if (bids.length >= 5) return;
    startTransition(async () => {
      const row = await addBid(projectId);
      setBids((bs) => [
        ...bs,
        {
          id: row.id,
          vendor_name: "",
          warranty_years: null,
          timeline_weeks: null,
          notes: null,
          amounts: {},
        },
      ]);
    });
  }

  function handleRemoveBid(bidId: string) {
    setBids((bs) => bs.filter((b) => b.id !== bidId));
    startTransition(() => removeBid(bidId));
  }

  function buildSummary() {
    const lines: string[] = [];
    lines.push(title || "Bid Comparison");
    lines.push("");
    bids.forEach((b, i) => {
      lines.push(`${b.vendor_name || "(unnamed vendor)"}${i === lowestTotalIdx ? "  — lowest total" : ""}`);
      items.forEach((it) => {
        const v = money(b.amounts[it.id]);
        lines.push(`  ${it.label || "(item)"}: ${v !== null ? fmt(v) : "—"}`);
      });
      lines.push(`  Total: ${totals[i] !== null ? fmt(totals[i]) : "—"}`);
      lines.push(
        `  Warranty: ${b.warranty_years ? `${b.warranty_years} yrs` : "—"}   Timeline: ${b.timeline_weeks ? `${b.timeline_weeks} wks` : "—"}`,
      );
      if (b.notes) lines.push(`  Notes: ${b.notes}`);
      lines.push("");
    });
    return lines.join("\n");
  }

  function copySummary() {
    const text = buildSummary();
    let copiedOk = false;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
      copiedOk = true;
    }
    if (taRef.current) {
      taRef.current.value = text;
      taRef.current.style.display = "block";
      taRef.current.focus();
      taRef.current.select();
    }
    if (copiedOk) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <div>
      <div className="mb-6 border-b-2 border-ink pb-4">
        <div className="mb-2 text-xs uppercase tracking-widest text-ink-soft" style={{ letterSpacing: "0.15em" }}>
          Bid Ledger · Capital Project Comparison
        </div>
        {isAdmin ? (
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Project name (e.g. Roof Replacement — 33 W Elmhurst Ave)"
            className="w-full bg-transparent font-serif text-2xl text-ink outline-none sm:text-3xl"
          />
        ) : (
          <h1 className="font-serif text-2xl text-ink sm:text-3xl">{title || "Untitled project"}</h1>
        )}
      </div>

      {isAdmin && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button onClick={handleAddBid} disabled={bids.length >= 5}>
            <Plus size={14} /> Add bid
          </Button>
          <Button onClick={handleAddItem} variant="outline">
            <Plus size={14} /> Add line item
          </Button>
          <div className="flex-1" />
          <ExportCsvButton action={exportCsv} filename="bid-comparison.csv" />
          <Button onClick={copySummary} variant="outline" className="!border-gold !text-gold-text">
            {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
            {copied ? "Copied" : "Copy summary"}
          </Button>
        </div>
      )}
      {!isAdmin && (
        <div className="mb-3 flex justify-end gap-2">
          <ExportCsvButton action={exportCsv} filename="bid-comparison.csv" />
          <Button onClick={copySummary} variant="outline" className="!border-gold !text-gold-text">
            {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
            {copied ? "Copied" : "Copy summary"}
          </Button>
        </div>
      )}

      <textarea
        ref={taRef}
        readOnly
        aria-label="Bid summary text"
        style={{
          display: "none",
          width: "100%",
          height: 160,
          marginBottom: 12,
          fontFamily: "monospace",
          fontSize: 12,
          padding: 8,
        }}
        className="border border-rule bg-paper-card text-ink"
      />

      <div className="overflow-x-auto rounded border border-rule bg-paper-card shadow-card">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 560 }}>
          <thead>
            <tr>
              <th
                className="w-40 border-b-2 border-ink p-3 text-left font-sans font-medium text-ink-soft"
              >
                Line item
              </th>
              {bids.map((b, i) => (
                <th
                  key={b.id}
                  className="relative border-b-2 border-ink border-l border-l-rule p-3 text-left"
                  style={{ minWidth: 190 }}
                >
                  {i === lowestTotalIdx && lowestTotal !== null && (
                    <div
                      className="absolute -top-3 right-2 flex items-center gap-1 rounded-full border border-dashed border-gold bg-paper-card px-2 py-0.5 text-xs font-bold uppercase text-gold-text"
                      style={{ transform: "rotate(-6deg)", letterSpacing: "0.08em" }}
                    >
                      <Stamp size={10} /> Best value
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-1">
                    {isAdmin ? (
                      <input
                        value={b.vendor_name}
                        onChange={(e) => handleBidFieldChange(b.id, "vendor_name", e.target.value)}
                        placeholder="Vendor name"
                        className="w-full bg-transparent font-serif text-base text-ink outline-none"
                      />
                    ) : (
                      <span className="font-serif text-base text-ink">
                        {b.vendor_name || "(unnamed vendor)"}
                      </span>
                    )}
                    {isAdmin && bids.length > 1 && (
                      <button onClick={() => handleRemoveBid(b.id)} className="mt-1 text-ink-soft">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const rowLowest = lowestForItem(it.id);
              return (
                <tr key={it.id}>
                  <td className="border-t border-rule p-3">
                    <div className="flex items-center gap-1">
                      {isAdmin ? (
                        <>
                          <input
                            value={it.label}
                            onChange={(e) => handleItemLabelChange(it.id, e.target.value)}
                            placeholder="Item"
                            className="w-full bg-transparent text-sm text-ink outline-none"
                          />
                          <button onClick={() => handleRemoveItem(it.id)} className="text-rule">
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <span className="text-sm text-ink">{it.label || "(item)"}</span>
                      )}
                    </div>
                  </td>
                  {bids.map((b) => {
                    const v = money(b.amounts[it.id]);
                    const isLowest = v !== null && rowLowest !== null && v === rowLowest;
                    return (
                      <td key={b.id} className="border-t border-rule border-l border-l-rule p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-ink-soft">$</span>
                          {isAdmin ? (
                            <input
                              value={b.amounts[it.id] ?? ""}
                              onChange={(e) => handleAmountChange(b.id, it.id, e.target.value)}
                              inputMode="decimal"
                              placeholder="0"
                              className="w-full bg-transparent font-mono outline-none"
                              style={{
                                color: isLowest ? "#3F6B4E" : "#1F2B3D",
                                fontWeight: isLowest ? 700 : 400,
                              }}
                            />
                          ) : (
                            <span
                              className="font-mono"
                              style={{ color: isLowest ? "#3F6B4E" : "#1F2B3D", fontWeight: isLowest ? 700 : 400 }}
                            >
                              {v !== null ? fmt(v) : "—"}
                            </span>
                          )}
                          {isLowest && <Check size={12} className="text-check-green" />}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            <tr>
              <td className="border-t-2 border-ink p-3 font-serif font-semibold">Total</td>
              {bids.map((b, i) => (
                <td key={b.id} className="border-t-2 border-ink border-l border-l-rule p-3">
                  <span
                    className="font-mono font-serif text-base font-bold"
                    // Gold darkened for text — see --color-gold-text in globals.css.
                    style={{ color: i === lowestTotalIdx && lowestTotal !== null ? "#83602A" : "#1F2B3D" }}
                  >
                    {fmt(totals[i])}
                  </span>
                </td>
              ))}
            </tr>

            <tr>
              <td className="border-t border-rule p-3 text-ink-soft">Warranty (yrs)</td>
              {bids.map((b) => {
                const isBest =
                  b.warranty_years !== null && longestWarranty !== null && b.warranty_years === longestWarranty;
                return (
                  <td key={b.id} className="border-t border-rule border-l border-l-rule p-3">
                    {isAdmin ? (
                      <input
                        value={b.warranty_years ?? ""}
                        onChange={(e) => handleBidNumberFieldChange(b.id, "warranty_years", e.target.value)}
                        inputMode="decimal"
                        placeholder="—"
                        className="w-16 bg-transparent font-mono outline-none"
                        style={{ color: isBest ? "#3F6B4E" : "#1F2B3D", fontWeight: isBest ? 700 : 400 }}
                      />
                    ) : (
                      <span
                        className="font-mono"
                        style={{ color: isBest ? "#3F6B4E" : "#1F2B3D", fontWeight: isBest ? 700 : 400 }}
                      >
                        {b.warranty_years ?? "—"}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>

            <tr>
              <td className="border-t border-rule p-3 text-ink-soft">Timeline (wks)</td>
              {bids.map((b) => {
                const isBest =
                  b.timeline_weeks !== null && shortestTimeline !== null && b.timeline_weeks === shortestTimeline;
                return (
                  <td key={b.id} className="border-t border-rule border-l border-l-rule p-3">
                    {isAdmin ? (
                      <input
                        value={b.timeline_weeks ?? ""}
                        onChange={(e) => handleBidNumberFieldChange(b.id, "timeline_weeks", e.target.value)}
                        inputMode="decimal"
                        placeholder="—"
                        className="w-16 bg-transparent font-mono outline-none"
                        style={{ color: isBest ? "#3F6B4E" : "#1F2B3D", fontWeight: isBest ? 700 : 400 }}
                      />
                    ) : (
                      <span
                        className="font-mono"
                        style={{ color: isBest ? "#3F6B4E" : "#1F2B3D", fontWeight: isBest ? 700 : 400 }}
                      >
                        {b.timeline_weeks ?? "—"}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>

            <tr>
              <td className="border-t border-rule p-3 align-top text-ink-soft">Notes</td>
              {bids.map((b) => (
                <td key={b.id} className="border-t border-rule border-l border-l-rule p-3 align-top">
                  {isAdmin ? (
                    <textarea
                      value={b.notes ?? ""}
                      onChange={(e) => handleBidFieldChange(b.id, "notes", e.target.value)}
                      placeholder="References, red flags, insurance/license notes…"
                      rows={2}
                      className="w-full resize-none bg-transparent text-xs text-ink-soft outline-none"
                    />
                  ) : (
                    <p className="text-xs text-ink-soft">{b.notes || "—"}</p>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-ink-soft">
        Gold marks the lowest total bid. Green checks mark the lowest amount in each row. This
        compares dollars only — weigh warranty, timeline, and notes before deciding.
      </div>
    </div>
  );
}
