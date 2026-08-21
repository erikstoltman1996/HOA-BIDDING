/**
 * Parses a board's bookkeeping export (monthly columns, income/expense rows,
 * a running ending-balance row — the shape a QuickBooks/spreadsheet export
 * typically takes) into two numbers the reserve tool can use: current
 * balance and an annualized reserve contribution.
 *
 * Deliberately label-based, not position-based — every HOA's export will
 * have a different number of rows, a different starting fiscal month, and
 * slightly different wording. This never guesses past what it can actually
 * find: a value that can't be located comes back null with an explanation
 * in `warnings`, for manual entry, rather than a wrong silent number.
 *
 * Works on a generic 2D grid so it's agnostic to the file format — the
 * Server Action that calls this is responsible for turning an .xlsx (via
 * exceljs) or .csv (via papaparse) into this same Cell[][] shape first.
 *
 * Handles two fundamentally different real-world shapes:
 *   - A monthly pivot/summary (categories as rows, months as columns,
 *     pre-totaled) — a board's own hand-built spreadsheet typically looks
 *     like this.
 *   - A flat transaction list (one row per real transaction: date, type,
 *     account, amount) — QuickBooks' own native "Transaction List by
 *     Date" export looks like this, and is arguably the more common real
 *     shape. Detected first (its header row is unambiguous — "Date",
 *     "Account", "Amount" columns — and doesn't overlap with the pivot
 *     shape's month-name header), aggregated by (account, month) into the
 *     same category-breakdown shape the pivot path produces, so every
 *     consumer downstream (the preview UI, bulkApplyExpenseImport) needs
 *     no awareness of which shape the source file actually was.
 */

import { periodKey } from "./dues";

export type Cell =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | { formula?: unknown; result?: unknown; text?: string; richText?: unknown };

export interface DetectedBalance {
  value: number;
  /** The month-header label the value came from, e.g. "June". */
  asOfLabel: string;
}

export interface DetectedContribution {
  value: number;
  /** How many of the detected month columns actually had a value. */
  monthsFound: number;
  /** True if fewer than 12 months were found and this was extrapolated. */
  annualized: boolean;
}

export interface ParsedFinancialImport {
  detectedBalance: DetectedBalance | null;
  detectedContribution: DetectedContribution | null;
  warnings: string[];
}

export interface DetectedExpenseEntry {
  /** First-of-month date string, e.g. "2026-07-01". */
  period: string;
  amount: number;
}

export interface DetectedExpenseCategory {
  label: string;
  entries: DetectedExpenseEntry[];
}

export interface ParsedExpenseBreakdown {
  categories: DetectedExpenseCategory[];
  warnings: string[];
}

export interface DetectedDuesEntry {
  /** First-of-month date string, e.g. "2026-07-01". */
  period: string;
  amount: number;
}

export interface DetectedDuesUnit {
  /** The unit identifier, e.g. "Unit A" — a common "Condo Dues -" /
   *  "Dues -" prefix is stripped when present (see extractUnitLabel), so
   *  this reads as a unit name rather than a full account-line label. */
  label: string;
  entries: DetectedDuesEntry[];
}

export interface ParsedDuesBreakdown {
  units: DetectedDuesUnit[];
  warnings: string[];
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_ABBR = MONTH_NAMES.map((m) => m.slice(0, 3));

const BALANCE_LABEL_RE = /end(ing)?\s*(bank\s*)?balance|cash\s*balance/i;
// A row combining checking with reserve savings/CDs (a QuickBooks-style
// cash-position summary's own rollup row, e.g. "Total for Checking,
// Savings, and CDs") is a strictly better reserve balance than a plain
// "End Bank Balance" — money moved into a reserve savings account or CD
// is still reserve money, it's just no longer sitting in the checking
// account BALANCE_LABEL_RE describes. Preferred over it below.
const COMBINED_BALANCE_LABEL_RE = /total\s+(for\s+)?checking,?\s*savings,?\s*(and\s*)?cds?/i;
const RESERVE_WORD_RE = /reserve/i;
const CONTRIBUTION_WORD_RE = /(contribution|fund)/i;
// "Dues" and "assessment" both name the same thing across different HOAs
// and condo associations — never hardcode just one term (see CLAUDE.md's
// design notes on not assuming "HOA"-specific phrasing).
const DUES_LABEL_RE = /\bdues\b|\bassessments?\b/i;

/** A row labeled like "Condo Dues - Unit A" or "HOA Dues: 123 Main St"
 *  names a unit after the dues/assessment word and a separator — strip
 *  down to just that part so the imported unit is called "Unit A", not
 *  the full account-line label. Falls back to the untouched label when a
 *  file doesn't follow this convention, so nothing is silently discarded. */
function extractUnitLabel(rawLabel: string): string {
  const match = rawLabel.match(/(?:dues|assessments?)\s*[-–:]\s*(.+)$/i);
  return match ? match[1].trim() : rawLabel;
}

function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "object") {
    // exceljs formula cells: { formula, result }. Rich text cells: { richText: [...] }.
    if ("text" in cell && typeof cell.text === "string") return cell.text;
    return "";
  }
  return String(cell).trim();
}

function cellNumber(cell: Cell): number | null {
  if (typeof cell === "number" && Number.isFinite(cell)) return cell;
  if (typeof cell === "object" && cell !== null && "result" in cell) {
    const r = cell.result;
    if (typeof r === "number" && Number.isFinite(r)) return r;
    if (typeof r === "string") return parseCleanedNumber(r);
    return null;
  }
  if (typeof cell === "string") return parseCleanedNumber(cell);
  return null;
}

function parseCleanedNumber(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  // Handle "$1,234.56" and accounting-style negatives like "(272.07)".
  const negative = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed.replace(/[()$,]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function cellDate(cell: Cell): Date | null {
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? null : cell;
  if (typeof cell === "object" && cell !== null && "result" in cell) {
    const r = cell.result;
    if (r instanceof Date) return Number.isNaN(r.getTime()) ? null : r;
    if (typeof r === "string") {
      const d = new Date(r);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  if (typeof cell === "string" && cell.trim() !== "") {
    const d = new Date(cell);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

interface MonthLabel {
  /** 0-indexed (0 = January). */
  monthIndex: number;
  /** Present when the header cell itself carries a year, e.g. "Jul 2025"
   *  (a real QuickBooks P&L header) as opposed to a bare "July" (a
   *  hand-built spreadsheet, where the year has to come from elsewhere —
   *  see parseExpenseBreakdown's startYear parameter). */
  year: number | null;
}

/** Recognizes both a bare month name ("July", "Jul") and a month-plus-year
 *  header ("July 2026", "Jul 2026") — the latter is how QuickBooks' own
 *  Profit & Loss export labels its columns, and carries its own year, so
 *  callers that need real calendar periods should prefer `.year` over
 *  inferring one when it's present. */
function parseMonthLabel(cell: Cell): MonthLabel | null {
  const s = cellText(cell).toLowerCase().trim();
  if (!s) return null;

  const bare = MONTH_NAMES.indexOf(s) !== -1 ? MONTH_NAMES.indexOf(s) : MONTH_ABBR.indexOf(s);
  if (bare !== -1) return { monthIndex: bare, year: null };

  const match = s.match(/^([a-z]+)\s+(\d{4})$/);
  if (match) {
    const [, word, yearStr] = match;
    const withYear = MONTH_NAMES.indexOf(word) !== -1 ? MONTH_NAMES.indexOf(word) : MONTH_ABBR.indexOf(word);
    if (withYear !== -1) return { monthIndex: withYear, year: Number(yearStr) };
  }

  return null;
}

function isMonthLabel(cell: Cell): boolean {
  return parseMonthLabel(cell) !== null;
}

interface MonthHeader {
  rowIndex: number;
  monthCols: number[];
}

/** Finds the row with the most month-name cells (>= 6), anywhere in the grid. */
function findMonthHeaderRow(grid: Cell[][]): MonthHeader | null {
  let best: MonthHeader | null = null;
  grid.forEach((row, rowIndex) => {
    const monthCols: number[] = [];
    row.forEach((cell, c) => {
      if (isMonthLabel(cell)) monthCols.push(c);
    });
    if (monthCols.length >= 6 && (!best || monthCols.length > best.monthCols.length)) {
      best = { rowIndex, monthCols };
    }
  });
  return best;
}

/** Every column before the first month column is treated as the label —
 *  handles both a single description column and an "item #" + description
 *  two-column layout, joined into one string to match against. */
function rowLabel(row: Cell[], firstMonthCol: number): string {
  return row
    .slice(0, firstMonthCol)
    .map(cellText)
    .filter(Boolean)
    .join(" ");
}

// --- Transaction-list shape (e.g. QuickBooks' native "Transaction List
// by Date" export) -----------------------------------------------------

interface TransactionHeader {
  rowIndex: number;
  dateCol: number;
  accountCol: number;
  amountCol: number;
  /** null if the file has no type column at all — still usable, just
   *  can't tell income transactions apart from expense ones by type. */
  typeCol: number | null;
  /** QuickBooks' "Name" column — the customer/vendor a transaction is
   *  tagged with. Every dues deposit typically shares one Account ("HOA
   *  Dues Income"), so Account alone can't tell units apart; Name usually
   *  can (the paying owner/unit). null if the file has no such column. */
  nameCol: number | null;
}

/** A transaction list's header row is unambiguous — exact (case-
 *  insensitive) "Date", "Account", "Amount" column labels — and shares no
 *  vocabulary with the pivot shape's month-name header, so there's no
 *  meaningful risk of the two detectors colliding on the same file. */
function findTransactionHeaderRow(grid: Cell[][]): TransactionHeader | null {
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] ?? [];
    let dateCol = -1;
    let accountCol = -1;
    let amountCol = -1;
    let typeCol = -1;
    let nameCol = -1;
    row.forEach((cell, c) => {
      const t = cellText(cell).toLowerCase().trim();
      if (t === "date") dateCol = c;
      else if (t === "account") accountCol = c;
      else if (t === "amount") amountCol = c;
      else if (t === "type" || t === "transaction type") typeCol = c;
      else if (t === "name") nameCol = c;
    });
    if (dateCol >= 0 && accountCol >= 0 && amountCol >= 0) {
      return {
        rowIndex: r,
        dateCol,
        accountCol,
        amountCol,
        typeCol: typeCol >= 0 ? typeCol : null,
        nameCol: nameCol >= 0 ? nameCol : null,
      };
    }
  }
  return null;
}

// QuickBooks' own transaction-type vocabulary for money coming in. Dues
// income is already tracked elsewhere in the app (the Dues page), so
// these are excluded from the expense breakdown entirely rather than
// showing up as a (nonsensical) negative-looking "expense category."
const INCOME_TRANSACTION_TYPES = new Set([
  "deposit", "sales receipt", "invoice", "payment", "sales", "received payment",
]);

export interface TransactionListAggregate {
  expenseCategories: DetectedExpenseCategory[];
  duesUnits: DetectedDuesUnit[];
  contribution: DetectedContribution | null;
  warnings: string[];
}

/**
 * Aggregates a flat transaction list by (Account, calendar month of Date),
 * splitting reserve-related transactions (an Account containing "reserve",
 * e.g. "Capital Reserve Transfer") into a contribution signal, dues/
 * assessment income transactions into per-unit dues, and everything else
 * into expense categories — the same shapes parseExpenseBreakdown and
 * parseDuesBreakdown produce from a pivot file, so downstream code never
 * needs to know which shape the source file actually was.
 */
export function aggregateTransactionList(grid: Cell[][]): TransactionListAggregate {
  const warnings: string[] = [];
  const header = findTransactionHeaderRow(grid);
  if (!header) {
    return { expenseCategories: [], duesUnits: [], contribution: null, warnings: [] };
  }

  const expenseTotals = new Map<string, Map<string, number>>(); // account -> period -> sum
  const duesTotals = new Map<string, Map<string, number>>(); // account -> period -> sum
  const reserveTotals = new Map<string, number>(); // period -> sum

  for (let r = header.rowIndex + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const date = cellDate(row[header.dateCol]);
    const account = cellText(row[header.accountCol]).trim();
    const amount = cellNumber(row[header.amountCol]);
    if (!date || !account || amount === null) continue;

    const period = periodKey(date);
    const type = header.typeCol !== null ? cellText(row[header.typeCol]).toLowerCase().trim() : "";
    if (INCOME_TRANSACTION_TYPES.has(type)) {
      // Income transactions are normally excluded entirely (dues income is
      // tracked on the Dues page, not as a negative-looking "expense") —
      // but a dues/assessment-labeled one is exactly what the Dues import
      // is looking for, so capture it before moving on. Every dues deposit
      // typically shares one Account ("HOA Dues Income"), which alone
      // would collapse every unit into one lump sum — Name (the customer
      // QuickBooks tags each deposit with, usually the paying owner/unit)
      // is the real per-unit signal when the file has one.
      if (DUES_LABEL_RE.test(account)) {
        const name = header.nameCol !== null ? cellText(row[header.nameCol]).trim() : "";
        const duesKey = name || account;
        if (!duesTotals.has(duesKey)) duesTotals.set(duesKey, new Map());
        const perPeriod = duesTotals.get(duesKey)!;
        perPeriod.set(period, (perPeriod.get(period) ?? 0) + amount);
      }
      continue;
    }

    if (RESERVE_WORD_RE.test(account)) {
      reserveTotals.set(period, (reserveTotals.get(period) ?? 0) + amount);
      continue;
    }

    if (!expenseTotals.has(account)) expenseTotals.set(account, new Map());
    const perPeriod = expenseTotals.get(account)!;
    perPeriod.set(period, (perPeriod.get(period) ?? 0) + amount);
  }

  const expenseCategories: DetectedExpenseCategory[] = [...expenseTotals.entries()].map(([label, periods]) => ({
    label,
    entries: [...periods.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, amount]) => ({ period, amount })),
  }));

  const duesUnits: DetectedDuesUnit[] = [...duesTotals.entries()].map(([label, periods]) => ({
    label: extractUnitLabel(label),
    entries: [...periods.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, amount]) => ({ period, amount })),
  }));

  let contribution: DetectedContribution | null = null;
  if (reserveTotals.size > 0) {
    const sum = [...reserveTotals.values()].reduce((a, b) => a + b, 0);
    const count = reserveTotals.size;
    const annualized = count < 12;
    contribution = { value: annualized ? sum * (12 / count) : sum, monthsFound: count, annualized };
  } else {
    warnings.push(
      'Couldn\'t find any reserve-related transactions (an Account containing "reserve") — enter the annual contribution manually.',
    );
  }

  if (expenseCategories.length === 0) {
    warnings.push("No expense transactions found in this file.");
  }

  return { expenseCategories, duesUnits, contribution, warnings };
}

export function parseFinancialImport(grid: Cell[][]): ParsedFinancialImport {
  const transactionHeader = findTransactionHeaderRow(grid);
  if (transactionHeader) {
    const agg = aggregateTransactionList(grid);
    return {
      detectedBalance: null,
      detectedContribution: agg.contribution,
      warnings: [
        "This looks like a transaction list, not a monthly summary — it records individual " +
          "transactions, not an account balance. Enter the current balance manually.",
        ...agg.warnings,
      ],
    };
  }

  const warnings: string[] = [];
  const header = findMonthHeaderRow(grid);

  if (!header) {
    return {
      detectedBalance: null,
      detectedContribution: null,
      warnings: [
        "Couldn't find a row of month names (January, February, ...) in this file's layout — enter values manually.",
      ],
    };
  }

  const firstMonthCol = Math.min(...header.monthCols);
  const orderedMonthCols = [...header.monthCols].sort((a, b) => a - b);

  function populatedMonthCount(row: Cell[]): number {
    return orderedMonthCols.filter((c) => cellNumber(row[c]) !== null).length;
  }

  // Scan every row (not just those after the header — a real export's
  // header row isn't necessarily above every data row; here the sheet's
  // best-matching month header turned out to be its *expense* section,
  // below the *income* section's reserve-contribution row). When more than
  // one row's label matches (e.g. both "Prior Year Ending Bank Balance"
  // and "End Bank Balance" match the balance pattern), prefer whichever
  // one actually has populated values — an empty label match is worse
  // than no match at all.
  let balanceRowIndex: number | null = null;
  let balanceRowScore = -1;
  let contributionRowIndex: number | null = null;
  let contributionRowScore = -1;

  grid.forEach((row, r) => {
    if (r === header.rowIndex) return;
    const label = rowLabel(row ?? [], firstMonthCol);
    if (!label) return;

    const isCombinedBalance = COMBINED_BALANCE_LABEL_RE.test(label);
    if (isCombinedBalance || BALANCE_LABEL_RE.test(label)) {
      // Combined-balance rows always outrank a plain end-balance row,
      // regardless of populated-month count — a +1000 bump keeps this a
      // two-tier preference (combined beats plain, populated count only
      // breaks ties within the same tier) without a separate code path.
      const score = populatedMonthCount(row ?? []) + (isCombinedBalance ? 1000 : 0);
      if (score > balanceRowScore) {
        balanceRowScore = score;
        balanceRowIndex = r;
      }
    }
    if (RESERVE_WORD_RE.test(label) && CONTRIBUTION_WORD_RE.test(label)) {
      const score = populatedMonthCount(row ?? []);
      if (score > contributionRowScore) {
        contributionRowScore = score;
        contributionRowIndex = r;
      }
    }
  });

  let detectedBalance: DetectedBalance | null = null;
  if (balanceRowIndex !== null) {
    const row = grid[balanceRowIndex] ?? [];
    let lastValue: number | null = null;
    let lastLabel = "";
    for (const c of orderedMonthCols) {
      const v = cellNumber(row[c]);
      if (v !== null) {
        lastValue = v;
        lastLabel = cellText(grid[header.rowIndex]?.[c]);
      }
    }
    if (lastValue !== null) {
      detectedBalance = { value: lastValue, asOfLabel: lastLabel };
    } else {
      warnings.push('Found an ending-balance row but no month had a value in it — enter the balance manually.');
    }
  } else {
    warnings.push("Couldn't find an ending-balance row — enter the current balance manually.");
  }

  let detectedContribution: DetectedContribution | null = null;
  if (contributionRowIndex !== null) {
    const row = grid[contributionRowIndex] ?? [];
    let sum = 0;
    let count = 0;
    for (const c of orderedMonthCols) {
      const v = cellNumber(row[c]);
      if (v !== null) {
        sum += v;
        count++;
      }
    }
    if (count > 0) {
      const annualized = count < 12;
      const value = annualized ? sum * (12 / count) : sum;
      detectedContribution = { value, monthsFound: count, annualized };
    } else {
      warnings.push("Found a reserve contribution row but no month had a value in it — enter the contribution manually.");
    }
  } else {
    warnings.push("Couldn't find a reserve-contribution row — enter the annual contribution manually.");
  }

  return { detectedBalance, detectedContribution, warnings };
}

// --- Shared by both section walkers (expense x month, dues x month) -------

const TOTAL_EXPENSE_RE = /total\s*expense/i;
const TOTAL_INCOME_RE = /total\s*income/i;
/** A row that's itself a section title rather than a line item — e.g.
 *  "Expenses - Monthly HOA". Distinguished from a real category row by
 *  requiring it to also have no numeric data of its own, which no real
 *  category/unit row in practice lacks. */
const EXPENSE_SECTION_HEADER_RE = /expense/i;
const INCOME_SECTION_HEADER_RE = /income/i;
/** Never matches anything — used as the "no additional backstop needed"
 *  default for walkSectionRows' stopAt parameter. */
const NEVER_RE = /(?!)/;

/**
 * Resolves a header row's month columns into real calendar periods,
 * preferring each column's own embedded year (e.g. "Jul 2025" — a real
 * QuickBooks export labels columns this way) when every column has one,
 * so a fiscal-year crossing needs no inference at all. Falls back to
 * `startYear` + an assumed chronological Jan-Dec (or fiscal-year) sequence
 * for bare month names ("July"), which carry no year of their own.
 * Shared by parseExpenseBreakdown and parseDuesBreakdown so the two can
 * never silently diverge on how a file's columns map to dates.
 */
function resolvePeriods(
  grid: Cell[][],
  header: MonthHeader,
  orderedMonthCols: number[],
  startYear: number,
): { periods: string[]; warning?: undefined } | { periods?: undefined; warning: string } {
  const monthLabels = orderedMonthCols.map((c) => parseMonthLabel(grid[header.rowIndex]?.[c]));
  if (monthLabels.some((m) => m === null)) {
    return { warning: "Some month columns didn't resolve to a recognizable month name" };
  }
  const labels = monthLabels as MonthLabel[];

  if (labels.every((m) => m.year !== null)) {
    return { periods: labels.map((m) => `${m.year}-${String(m.monthIndex + 1).padStart(2, "0")}-01`) };
  }

  const monthIndices = labels.map((m) => m.monthIndex);
  for (let i = 1; i < monthIndices.length; i++) {
    const expected = (monthIndices[i - 1] + 1) % 12;
    if (monthIndices[i] !== expected) {
      return {
        warning:
          "Month columns in this file aren't in sequential order — this importer assumes a normal Jan-Dec (or fiscal-year) sequence",
      };
    }
  }
  const periods = monthIndices.map((mi, i) => {
    // Walk forward from the first column's (year, month) rather than
    // assuming every column is in the same calendar year — a fiscal year
    // starting mid-year crosses into the next calendar year partway through.
    const firstMonth = monthIndices[0];
    const yearsElapsed = Math.floor((firstMonth + i) / 12);
    const y = startYear + yearsElapsed;
    return `${y}-${String(mi + 1).padStart(2, "0")}-01`;
  });
  return { periods };
}

/**
 * Walks upward from a "Total X" row collecting line-item rows until it
 * hits the section's own header (a row matching `sectionWordRe` with no
 * numeric data of its own — a real line item always has at least one
 * populated month) or `stopAtRe` as a hard backstop against bleeding into
 * a neighboring section. Shared by the expense and dues walkers, which are
 * structurally identical, just anchored to different section/total rows.
 */
function walkSectionRows(
  grid: Cell[][],
  header: MonthHeader,
  firstMonthCol: number,
  orderedMonthCols: number[],
  totalRowIndex: number,
  sectionWordRe: RegExp,
  stopAtRe: RegExp = NEVER_RE,
): { label: string; row: Cell[] }[] {
  const rows: { label: string; row: Cell[] }[] = [];
  for (let r = totalRowIndex - 1; r >= 0; r--) {
    if (r === header.rowIndex) break;
    const row = grid[r] ?? [];
    const label = rowLabel(row, firstMonthCol);
    if (!label) continue; // blank separator row — keep walking up
    if (stopAtRe.test(label)) break;
    if (sectionWordRe.test(label) && !orderedMonthCols.some((c) => cellNumber(row[c]) !== null)) break;
    rows.push({ label, row });
  }
  rows.reverse(); // walked upward, so restore original top-to-bottom order
  return rows;
}

function entriesFromRow(row: Cell[], orderedMonthCols: number[], periods: string[]): DetectedDuesEntry[] {
  const entries: DetectedDuesEntry[] = [];
  orderedMonthCols.forEach((c, i) => {
    const amount = cellNumber(row[c]);
    if (amount !== null) entries.push({ period: periods[i], amount });
  });
  return entries;
}

// --- Full expense breakdown (category x month) -----------------------------

/**
 * Finds every expense line-item row (between an "Expenses" section and its
 * "Total Expense" row) and reads out its value for each month column,
 * mapped to a real calendar period (see resolvePeriods). `startYear` is
 * only used on the pivot-file path with bare month-name headers — a
 * transaction list carries a real date per row and needs no anchor year.
 */
export function parseExpenseBreakdown(grid: Cell[][], startYear: number): ParsedExpenseBreakdown {
  const transactionHeader = findTransactionHeaderRow(grid);
  if (transactionHeader) {
    const agg = aggregateTransactionList(grid);
    return { categories: agg.expenseCategories, warnings: agg.warnings };
  }

  const warnings: string[] = [];
  const header = findMonthHeaderRow(grid);

  if (!header) {
    return {
      categories: [],
      warnings: ["Couldn't find a row of month names in this file's layout — add categories manually."],
    };
  }

  const firstMonthCol = Math.min(...header.monthCols);
  const orderedMonthCols = [...header.monthCols].sort((a, b) => a - b);

  const resolved = resolvePeriods(grid, header, orderedMonthCols, startYear);
  if (!resolved.periods) {
    return { categories: [], warnings: [`${resolved.warning} — add categories manually.`] };
  }
  const periods = resolved.periods;

  let totalExpenseRow = -1;
  grid.forEach((row, r) => {
    if (r === header.rowIndex) return;
    const label = rowLabel(row ?? [], firstMonthCol);
    if (totalExpenseRow === -1 && TOTAL_EXPENSE_RE.test(label)) totalExpenseRow = r;
  });

  if (totalExpenseRow === -1) {
    return {
      categories: [],
      warnings: ["Couldn't find a \"Total Expense\" row to anchor the expense list — add categories manually."],
    };
  }

  const rawRows = walkSectionRows(
    grid,
    header,
    firstMonthCol,
    orderedMonthCols,
    totalExpenseRow,
    EXPENSE_SECTION_HEADER_RE,
    TOTAL_INCOME_RE, // hard backstop against bleeding into the income section
  );
  const categories: DetectedExpenseCategory[] = rawRows.map(({ label, row }) => ({
    label,
    entries: entriesFromRow(row, orderedMonthCols, periods),
  }));

  if (categories.length === 0) {
    warnings.push('Found a "Total Expense" row but no category rows above it — add categories manually.');
  }
  if (orderedMonthCols.length > 12) {
    warnings.push(
      `Found ${orderedMonthCols.length} month columns (more than a year's worth) — double-check the imported dates below before saving, especially if any month name appears more than once in this file.`,
    );
  }

  return { categories, warnings };
}

// --- Dues breakdown (unit x month) -----------------------------------------

/**
 * Finds every dues/assessment line-item row inside a file's Income section
 * (between an "Income" section and its "Total Income" row) and reads out
 * its per-month value — actual cash received, on a cash-accounting file
 * like a real P&L — as a per-unit dues breakdown. Everything else in
 * Income (a reserve contribution, late fees, a one-off deposit, ...) is
 * deliberately left alone; only rows whose label contains "dues" or
 * "assessment" are treated as a unit (see DUES_LABEL_RE).
 */
export function parseDuesBreakdown(grid: Cell[][], startYear: number): ParsedDuesBreakdown {
  const transactionHeader = findTransactionHeaderRow(grid);
  if (transactionHeader) {
    const agg = aggregateTransactionList(grid);
    const warnings = [...agg.warnings];
    if (agg.duesUnits.length === 0) {
      warnings.push(
        'No dues/assessment income transactions found (an Account containing "dues" or "assessment") — add units manually.',
      );
    }
    return { units: agg.duesUnits, warnings };
  }

  const warnings: string[] = [];
  const header = findMonthHeaderRow(grid);

  if (!header) {
    return {
      units: [],
      warnings: ["Couldn't find a row of month names in this file's layout — add units manually."],
    };
  }

  const firstMonthCol = Math.min(...header.monthCols);
  const orderedMonthCols = [...header.monthCols].sort((a, b) => a - b);

  const resolved = resolvePeriods(grid, header, orderedMonthCols, startYear);
  if (!resolved.periods) {
    return { units: [], warnings: [`${resolved.warning} — add units manually.`] };
  }
  const periods = resolved.periods;

  let totalIncomeRow = -1;
  grid.forEach((row, r) => {
    if (r === header.rowIndex) return;
    const label = rowLabel(row ?? [], firstMonthCol);
    if (totalIncomeRow === -1 && TOTAL_INCOME_RE.test(label)) totalIncomeRow = r;
  });

  if (totalIncomeRow === -1) {
    return {
      units: [],
      warnings: ["Couldn't find a \"Total Income\" row to anchor the dues list — add units manually."],
    };
  }

  const rawRows = walkSectionRows(grid, header, firstMonthCol, orderedMonthCols, totalIncomeRow, INCOME_SECTION_HEADER_RE);
  const units: DetectedDuesUnit[] = rawRows
    .filter(({ label }) => DUES_LABEL_RE.test(label))
    .map(({ label, row }) => ({
      label: extractUnitLabel(label),
      entries: entriesFromRow(row, orderedMonthCols, periods),
    }));

  if (units.length === 0) {
    warnings.push('Found a "Total Income" row but no line item matched a dues/assessment label — add units manually.');
  }
  if (orderedMonthCols.length > 12) {
    warnings.push(
      `Found ${orderedMonthCols.length} month columns (more than a year's worth) — double-check the imported dates below before saving, especially if any month name appears more than once in this file.`,
    );
  }

  return { units, warnings };
}
