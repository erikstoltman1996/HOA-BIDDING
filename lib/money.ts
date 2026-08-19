// Ported from bid-ledger.html — same parsing/formatting rules, so the DB-backed
// ledger behaves identically to the prototype.

export function money(n: string | number | null | undefined): number | null {
  if (n === null || n === undefined) return null;
  const v = typeof n === "number" ? n : parseFloat(n);
  if (isNaN(v)) return null;
  return v;
}

export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
