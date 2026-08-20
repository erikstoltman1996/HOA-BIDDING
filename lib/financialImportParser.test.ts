import { describe, expect, it } from "vitest";
import { parseFinancialImport, type Cell } from "./financialImportParser";

// Shaped like the real sample export: title row, month-header row starting
// in July (not January), an item-number + description two-column label,
// a reserve-contribution row, and an ending-balance row whose cells are
// exceljs-style formula objects ({ formula, result }) rather than plain
// numbers — which is what a real spreadsheet's running-total row is.
function sampleGrid(): Cell[][] {
  return [
    ["West Elmhurst Condo Association", "Income vs Expenses", "FY 2026"],
    [null, null, " July", "August", "September", "October", "November", "December"],
    [1, "Captal Reserves Contribution", 500, null, null, null, null, null],
    [2, "Condo Dues - Unit A", 250, 250, 250, 250, 250, 250],
    ["Total Income", null, 750, 250, 250, 250, 250, 250],
    [
      null,
      "End Bank Balance",
      { formula: "C3", result: 14928.91 },
      { formula: "C_+D3", result: 15312.93 },
      { formula: "D_+E3", result: 15040.86 },
      { formula: "E_+F3", result: 15681.77 },
      { formula: "F_+G3", result: 15931.77 },
      { formula: "G_+H3", result: 16181.77 },
    ],
  ];
}

describe("parseFinancialImport", () => {
  it("detects the ending balance as the last populated month's value", () => {
    const result = parseFinancialImport(sampleGrid());
    expect(result.detectedBalance).toEqual({ value: 16181.77, asOfLabel: "December" });
  });

  it("detects the reserve contribution row despite the item-number prefix and typo ('Captal')", () => {
    const result = parseFinancialImport(sampleGrid());
    expect(result.detectedContribution?.value).toBeCloseTo(500 * 12); // 1 of 12 months found, annualized
    expect(result.detectedContribution?.monthsFound).toBe(1);
    expect(result.detectedContribution?.annualized).toBe(true);
  });

  it("does not use Total Income as a stand-in for reserve contribution", () => {
    // Total Income row exists in the fixture but must never be mistaken
    // for the reserve-specific contribution row.
    const result = parseFinancialImport(sampleGrid());
    expect(result.detectedContribution?.value).not.toBeCloseTo(750 + 250 + 250 + 250 + 250 + 250);
  });

  it("annualizes correctly when exactly 12 months are present (no extrapolation)", () => {
    const grid: Cell[][] = [
      [null, "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      ["Reserve Fund Contribution", 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
    ];
    const result = parseFinancialImport(grid);
    expect(result.detectedContribution).toEqual({ value: 1200, monthsFound: 12, annualized: false });
  });

  it("handles accounting-style parenthesized negatives and currency formatting in string cells", () => {
    const grid: Cell[][] = [
      [null, "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      ["Ending Balance", "$1,000.00", "($200.00)", "$900.00", null, null, null],
    ];
    const result = parseFinancialImport(grid);
    expect(result.detectedBalance).toEqual({ value: 900, asOfLabel: "Mar" });
  });

  it("degrades to manual-entry warnings, not a crash, when nothing recognizable is found", () => {
    const grid: Cell[][] = [
      ["This", "spreadsheet", "has"],
      ["nothing", "resembling", "a", "monthly", "export"],
    ];
    const result = parseFinancialImport(grid);
    expect(result.detectedBalance).toBeNull();
    expect(result.detectedContribution).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("still finds the balance row even when the contribution row is absent", () => {
    const grid: Cell[][] = [
      [null, "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      ["End Bank Balance", 1000, 1100, 1200, 1300, 1400, 1500],
    ];
    const result = parseFinancialImport(grid);
    expect(result.detectedBalance).toEqual({ value: 1500, asOfLabel: "Jun" });
    expect(result.detectedContribution).toBeNull();
    expect(result.warnings.some((w) => w.includes("reserve-contribution"))).toBe(true);
  });

  it("prefers a populated balance-label match over an earlier empty one with a similar label", () => {
    // Regression: a real export had both "Prior Year Ending Bank Balance"
    // (always blank) and "End Bank Balance" (the real running total) —
    // both match the balance keyword pattern, and the blank one appeared
    // first. Taking the first match instead of the best one silently lost
    // real data.
    const grid: Cell[][] = [
      [null, null, "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      [null, "Prior Year Ending Bank Balance", null, null, null, null, null, null],
      [null, "End Bank Balance", 1000, 1100, 1200, 1300, 1400, 1500],
    ];
    const result = parseFinancialImport(grid);
    expect(result.detectedBalance).toEqual({ value: 1500, asOfLabel: "Jun" });
  });

  it("finds a label row that appears before the row chosen as the month header", () => {
    // Regression: a real export's best-matching month-header row (most
    // recognizable month-name cells) was its *expense* section, physically
    // below the *income* section's reserve-contribution row. Restricting
    // the label search to rows after the header missed it entirely.
    const grid: Cell[][] = [
      [null, "Jan", "Feb", "Mar", "Apr", "May", "Jun"], // 6 month cells
      ["Reserve Contribution", 500, null, null, null, null, null],
      ["Expenses", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], // 12 — wins as header
    ];
    const result = parseFinancialImport(grid);
    expect(result.detectedContribution?.monthsFound).toBe(1);
    expect(result.detectedContribution?.value).toBeCloseTo(500 * 12);
  });

  it("is case- and whitespace-insensitive on month names and labels", () => {
    const grid: Cell[][] = [
      [null, " JANUARY ", "february", "  March", "April", "may", "JUNE"],
      ["  ENDING balance  ", 500, 600, 700, 800, 900, 1000],
    ];
    const result = parseFinancialImport(grid);
    expect(result.detectedBalance?.value).toBe(1000);
  });
});
