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
 */

export type Cell =
  | string
  | number
  | boolean
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

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_ABBR = MONTH_NAMES.map((m) => m.slice(0, 3));

const BALANCE_LABEL_RE = /end(ing)?\s*(bank\s*)?balance|cash\s*balance/i;
const RESERVE_WORD_RE = /reserve/i;
const CONTRIBUTION_WORD_RE = /(contribution|fund)/i;

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

function isMonthLabel(cell: Cell): boolean {
  const s = cellText(cell).toLowerCase();
  return MONTH_NAMES.includes(s) || MONTH_ABBR.includes(s);
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

export function parseFinancialImport(grid: Cell[][]): ParsedFinancialImport {
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

    if (BALANCE_LABEL_RE.test(label)) {
      const score = populatedMonthCount(row ?? []);
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
