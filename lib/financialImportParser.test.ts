import { describe, expect, it } from "vitest";
import {
  aggregateTransactionList,
  parseDuesBreakdown,
  parseExpenseBreakdown,
  parseFinancialImport,
  type Cell,
} from "./financialImportParser";

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

// Shaped like the real sample export's expense section: an "Expenses"
// section header (with its own month-name row, no numeric data), several
// category rows with an item-number prefix, a blank separator row, and a
// "Total Expense" row anchoring the bottom.
function expenseSectionGrid(): Cell[][] {
  return [
    ["Expenses - Monthly HOA", null, "July", "August", "September", "October", "November", "December"],
    [1, "Bookkeeping Service", 100, 100, 100, 100, 100, 100],
    [2, "Snow Plowing", null, null, null, null, 250, 300],
    [null, null, null, null, null, null, null, null],
    ["Total Expense", null, 100, 100, 100, 100, 350, 400],
  ];
}

describe("parseExpenseBreakdown", () => {
  it("collects every category row between the section header and Total Expense", () => {
    const result = parseExpenseBreakdown(expenseSectionGrid(), 2026);
    expect(result.categories.map((c) => c.label)).toEqual(["1 Bookkeeping Service", "2 Snow Plowing"]);
  });

  it("maps each month column to a real calendar period, starting from the given year", () => {
    const result = parseExpenseBreakdown(expenseSectionGrid(), 2026);
    const bookkeeping = result.categories[0];
    expect(bookkeeping.entries).toEqual([
      { period: "2026-07-01", amount: 100 },
      { period: "2026-08-01", amount: 100 },
      { period: "2026-09-01", amount: 100 },
      { period: "2026-10-01", amount: 100 },
      { period: "2026-11-01", amount: 100 },
      { period: "2026-12-01", amount: 100 },
    ]);
  });

  it("only records months that actually have a value, skipping blanks", () => {
    const result = parseExpenseBreakdown(expenseSectionGrid(), 2026);
    const snowPlowing = result.categories[1];
    expect(snowPlowing.entries).toEqual([
      { period: "2026-11-01", amount: 250 },
      { period: "2026-12-01", amount: 300 },
    ]);
  });

  it("rolls the year forward when a fiscal year crosses a calendar-year boundary", () => {
    const grid: Cell[][] = [
      ["Expenses", null, "November", "December", "January", "February", "March", "April"],
      [1, "Insurance", 50, 50, 50, 50, 50, 50],
      ["Total Expense", null, 50, 50, 50, 50, 50, 50],
    ];
    const result = parseExpenseBreakdown(grid, 2026);
    expect(result.categories[0].entries.map((e) => e.period)).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01", // crossed into the next calendar year
      "2027-02-01",
      "2027-03-01",
      "2027-04-01",
    ]);
  });

  it("stops at Total Income rather than bleeding into the income section", () => {
    const grid: Cell[][] = [
      ["Income", null, "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      [1, "Dues", 500, 500, 500, 500, 500, 500],
      ["Total Income", null, 500, 500, 500, 500, 500, 500],
      ["Expenses", null, "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      [1, "Insurance", 50, 50, 50, 50, 50, 50],
      ["Total Expense", null, 50, 50, 50, 50, 50, 50],
    ];
    const result = parseExpenseBreakdown(grid, 2026);
    expect(result.categories.map((c) => c.label)).toEqual(["1 Insurance"]);
  });

  it("degrades to an empty result with a warning when there's no Total Expense row", () => {
    const grid: Cell[][] = [
      ["Expenses", null, "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      [1, "Insurance", 50, 50, 50, 50, 50, 50],
    ];
    const result = parseExpenseBreakdown(grid, 2026);
    expect(result.categories).toEqual([]);
    expect(result.warnings.some((w) => w.includes("Total Expense"))).toBe(true);
  });

  it("degrades gracefully when month columns aren't sequential, instead of mislabeling periods", () => {
    const grid: Cell[][] = [
      ["Expenses", null, "January", "March", "February", "April", "May", "June"],
      [1, "Insurance", 50, 50, 50, 50, 50, 50],
      ["Total Expense", null, 50, 50, 50, 50, 50, 50],
    ];
    const result = parseExpenseBreakdown(grid, 2026);
    expect(result.categories).toEqual([]);
    expect(result.warnings.some((w) => w.includes("sequential"))).toBe(true);
  });

  it("warns when more than 12 month columns are found, without discarding the data", () => {
    const grid: Cell[][] = [
      [
        "Expenses", null,
        "July", "August", "September", "October", "November", "December",
        "January", "February", "March", "April", "May", "June",
        "July", "August",
      ],
      [1, "Insurance", 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
      [
        "Total Expense", null,
        50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
      ],
    ];
    const result = parseExpenseBreakdown(grid, 2026);
    expect(result.categories).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes("more than a year"))).toBe(true);
  });
});

// Shaped like QuickBooks' own Profit & Loss export: month headers carry
// their own year ("Jul 2025", not bare "July"), and the fiscal year
// crosses a calendar-year boundary partway through — a third real-world
// shape, distinct from both the bare-month-name pivot and the flat
// transaction list.
function profitAndLossGrid(): Cell[][] {
  return [
    [null, "West Elmhurst Condo Association"],
    [null, "Profit and Loss"],
    [null, null, "Jul 2025", "Aug 2025", "Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025", "Jan 2026", "TOTAL"],
    [null, "Income"],
    [1, "Captal Reserves Contribution", 500, null, null, null, 500, null, null, 1000],
    [2, "Condo Dues - Unit A", 250, 250, 250, 250, 0, 250, 250, 1700],
    [3, "Condo Dues - Unit B", 250, 0, 0, 0, 0, 0, null, 250],
    [null, "Total Income", 1000, 250, 250, 250, 500, 250, 250, 2950],
    [null, "Expenses"],
    [1, "Insurance", null, null, 200, null, null, null, 200, 400],
    [2, "Electric", 25, 25, 25, 25, 25, 25, 25, 175],
    [3, "Transfer to CD #1", null, null, null, null, null, 2000, null, 2000],
    [null, "Total Expenses", 25, 25, 225, 25, 25, 2025, 225, 2575],
    [null, "End Bank Balance", 14928.89, 15312.89, 15040.78, 15046.19, 16046.19, 11730.05, 10099.02],
  ];
}

describe("parseExpenseBreakdown on a QuickBooks-style Profit & Loss export", () => {
  it("maps each column to its own embedded year, not the given startYear", () => {
    // startYear is 1999 here specifically to prove it's ignored — every
    // period below should land in 2025/2026, taken from the header cells.
    const result = parseExpenseBreakdown(profitAndLossGrid(), 1999);
    const electric = result.categories.find((c) => c.label === "2 Electric")!;
    expect(electric.entries.map((e) => e.period)).toEqual([
      "2025-07-01",
      "2025-08-01",
      "2025-09-01",
      "2025-10-01",
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
    ]);
  });

  it("crosses the calendar-year boundary correctly using the header's own years", () => {
    const result = parseExpenseBreakdown(profitAndLossGrid(), 1999);
    const insurance = result.categories.find((c) => c.label === "1 Insurance")!;
    // Only September (2025) and January (2026) actually have values.
    expect(insurance.entries).toEqual([
      { period: "2025-09-01", amount: 200 },
      { period: "2026-01-01", amount: 200 }, // TOTAL column excluded — not a month
    ]);
  });

  it("excludes a reserve/CD transfer line from the expense breakdown, with a warning", () => {
    // Money moving into a reserve savings account or CD isn't spent — it's
    // still reserve money, just relocated. Counting it as an operating
    // expense would both inflate the total and double-subtract it from
    // the Reserve page's combined cash summary.
    const result = parseExpenseBreakdown(profitAndLossGrid(), 1999);
    expect(result.categories.some((c) => c.label.includes("Transfer to CD"))).toBe(false);
    expect(result.warnings.some((w) => w.includes("Transfer to CD #1") && w.includes("reserve"))).toBe(true);
    // The real categories on either side of it are untouched.
    expect(result.categories.map((c) => c.label)).toEqual(["1 Insurance", "2 Electric"]);
  });
});

describe("parseDuesBreakdown on a QuickBooks-style Profit & Loss export", () => {
  it("finds per-unit dues rows inside the Income section and ignores everything else there", () => {
    const result = parseDuesBreakdown(profitAndLossGrid(), 1999);
    expect(result.units.map((u) => u.label)).toEqual(["Unit A", "Unit B"]);
    // "1 Captal Reserves Contribution" is in the same Income section but
    // isn't dues-labeled, and must not show up as a "unit."
    expect(result.units.some((u) => u.label.includes("Reserve"))).toBe(false);
  });

  it("strips the \"Condo Dues -\" prefix down to just the unit name", () => {
    const result = parseDuesBreakdown(profitAndLossGrid(), 1999);
    const unitA = result.units.find((u) => u.label === "Unit A")!;
    expect(unitA.entries).toEqual([
      { period: "2025-07-01", amount: 250 },
      { period: "2025-08-01", amount: 250 },
      { period: "2025-09-01", amount: 250 },
      { period: "2025-10-01", amount: 250 },
      { period: "2025-11-01", amount: 0 }, // an explicit $0 month is kept, not skipped
      { period: "2025-12-01", amount: 250 },
      { period: "2026-01-01", amount: 250 },
    ]);
  });

  it("skips blank months rather than treating them as $0", () => {
    const result = parseDuesBreakdown(profitAndLossGrid(), 1999);
    const unitB = result.units.find((u) => u.label === "Unit B")!;
    // Unit B's January cell is blank in the fixture — must be absent, not
    // a fabricated { amount: 0 } entry.
    expect(unitB.entries.some((e) => e.period === "2026-01-01")).toBe(false);
  });
});

describe("parseFinancialImport on a QuickBooks-style Profit & Loss export", () => {
  it("finds the header row and detects balance/contribution despite month-plus-year headers", () => {
    const result = parseFinancialImport(profitAndLossGrid());
    expect(result.detectedBalance).toEqual({ value: 10099.02, asOfLabel: "Jan 2026" });
    expect(result.detectedContribution).toEqual({ value: 6000, monthsFound: 2, annualized: true });
  });

  it("prefers a combined checking+savings+CDs row over a plain end-balance row", () => {
    // Reserve money parked in a savings account or CD leaves the checking
    // balance ("End Bank Balance") but is still reserve money — a rollup
    // row naming all three account types is the more complete figure, and
    // should win even though the plain balance row appears first and has
    // just as many populated months.
    const grid = profitAndLossGrid();
    grid.push([null, "Total for Checking, Savings, and CDs", 15000, 15100, 15200, 15300, 16000, 12000, 10500]);
    const result = parseFinancialImport(grid);
    expect(result.detectedBalance).toEqual({ value: 10500, asOfLabel: "Jan 2026" });
  });
});

// Shaped exactly like QuickBooks' native "Transaction List by Date"
// export: one row per real transaction, no month columns at all — the
// fundamentally different real-world shape from the pivot fixture above.
function transactionListGrid(): Cell[][] {
  return [
    ["W. Elmhurst Condo Association"],
    ["Transaction List by Date"],
    ["January - June 2026"],
    [],
    ["Date", "Transaction Type", "Num", "Name", "Memo/Description", "Account", "Split", "Amount"],
    ["2026-01-05", "Deposit", "", "Unit A", "Monthly HOA dues", "HOA Dues Income", "Operating Checking", 450],
    ["2026-01-05", "Deposit", "", "Unit B", "Monthly HOA dues", "HOA Dues Income", "Operating Checking", 450],
    ["2026-01-06", "Journal Entry", "", "W. Elmhurst Condo Association", "Monthly reserve contribution", "Capital Reserve Transfer", "Reserve Savings", 800],
    ["2026-01-15", "Check", "", "Bookkeeping Service", "Bookkeeping Fees - 2026-01", "Bookkeeping Fees", "Operating Checking", 120],
    ["2026-01-15", "Check", "", "Pest Control Co", "Pest Control - 2026-01", "Pest Control", "Operating Checking", 55],
    ["2026-02-05", "Deposit", "", "Unit A", "Monthly HOA dues", "HOA Dues Income", "Operating Checking", 450],
    ["2026-02-06", "Journal Entry", "", "W. Elmhurst Condo Association", "Monthly reserve contribution", "Capital Reserve Transfer", "Reserve Savings", 800],
    ["2026-02-15", "Check", "", "Bookkeeping Service", "Bookkeeping Fees - 2026-02", "Bookkeeping Fees", "Operating Checking", 120],
    ["2026-02-15", "Check", "", "Pest Control Co", "Pest Control - 2026-02", "Pest Control", "Operating Checking", 60],
    [null, null, null, null, null, null, "Total", { formula: "SUM(H6:H13)", result: 3305 }],
  ];
}

describe("aggregateTransactionList", () => {
  it("groups expense transactions by account and month", () => {
    const result = aggregateTransactionList(transactionListGrid());
    const bookkeeping = result.expenseCategories.find((c) => c.label === "Bookkeeping Fees");
    expect(bookkeeping?.entries).toEqual([
      { period: "2026-01-01", amount: 120 },
      { period: "2026-02-01", amount: 120 },
    ]);
    const pest = result.expenseCategories.find((c) => c.label === "Pest Control");
    expect(pest?.entries).toEqual([
      { period: "2026-01-01", amount: 55 },
      { period: "2026-02-01", amount: 60 },
    ]);
  });

  it("excludes Deposit (income) transactions from expense categories entirely", () => {
    const result = aggregateTransactionList(transactionListGrid());
    expect(result.expenseCategories.some((c) => c.label === "HOA Dues Income")).toBe(false);
  });

  it("routes an account containing \"reserve\" to the contribution signal, not an expense category", () => {
    const result = aggregateTransactionList(transactionListGrid());
    expect(result.expenseCategories.some((c) => c.label === "Capital Reserve Transfer")).toBe(false);
    expect(result.contribution).toEqual({ value: 800 * 12, monthsFound: 2, annualized: true });
  });

  it("returns nothing (not an error) when the grid has no transaction-list header", () => {
    const result = aggregateTransactionList([["some", "random", "sheet"]]);
    expect(result.expenseCategories).toEqual([]);
    expect(result.contribution).toBeNull();
  });
});

describe("parseFinancialImport on a transaction list", () => {
  it("never guesses a balance from a transaction list — says so explicitly", () => {
    const result = parseFinancialImport(transactionListGrid());
    expect(result.detectedBalance).toBeNull();
    expect(result.warnings.some((w) => w.includes("transaction list"))).toBe(true);
  });

  it("still detects the reserve contribution from reserve-labeled transactions", () => {
    const result = parseFinancialImport(transactionListGrid());
    expect(result.detectedContribution?.value).toBeCloseTo(800 * 12);
  });
});

describe("parseExpenseBreakdown on a transaction list", () => {
  it("produces categories straight from the transactions, ignoring startYear entirely", () => {
    // startYear is meaningless here — every transaction already carries its
    // own real date — passing an obviously-wrong one proves it's unused.
    const result = parseExpenseBreakdown(transactionListGrid(), 1999);
    const bookkeeping = result.categories.find((c) => c.label === "Bookkeeping Fees");
    expect(bookkeeping?.entries[0].period).toBe("2026-01-01");
  });
});

describe("dues detection on a transaction list", () => {
  it("groups dues deposits by Name (the paying unit), not by Account", () => {
    // Every deposit in the fixture shares one Account ("HOA Dues Income")
    // — grouping by Account alone would collapse Unit A and Unit B into a
    // single lump sum. Name is what actually tells them apart.
    const result = aggregateTransactionList(transactionListGrid());
    expect(result.duesUnits.map((u) => u.label).sort()).toEqual(["Unit A", "Unit B"]);
    const unitA = result.duesUnits.find((u) => u.label === "Unit A")!;
    expect(unitA.entries).toEqual([
      { period: "2026-01-01", amount: 450 },
      { period: "2026-02-01", amount: 450 },
    ]);
  });

  it("never lets a dues deposit leak into expense categories", () => {
    const result = aggregateTransactionList(transactionListGrid());
    expect(result.expenseCategories.some((c) => c.label === "HOA Dues Income")).toBe(false);
  });

  it("parseDuesBreakdown produces the same per-unit shape, ignoring startYear entirely", () => {
    const result = parseDuesBreakdown(transactionListGrid(), 1999);
    const unitB = result.units.find((u) => u.label === "Unit B")!;
    expect(unitB.entries).toEqual([{ period: "2026-01-01", amount: 450 }]);
  });
});
