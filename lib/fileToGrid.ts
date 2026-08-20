import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { Cell } from "@/lib/financialImportParser";

// This is a small categorized cash-flow sheet, not a scanned archive.
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Converts an uploaded CSV or XLSX File into the generic Cell[][] grid
 * lib/financialImportParser.ts operates on. Shared between the reserve
 * balance/contribution importer and the expense-breakdown importer so the
 * file-format handling (and its size/type guards) exists in one place.
 */
export async function fileToGrid(file: File): Promise<Cell[][]> {
  if (file.size === 0) throw new Error("That file is empty");
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error("File is too large (5MB max) — this should just be a monthly income/expense sheet");
  }

  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (name.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(buffer);
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
    return parsed.data;
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error("That workbook has no sheets");
    const grid: Cell[][] = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const values: Cell[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        values.push(cell.value as Cell);
      });
      grid.push(values);
    });
    return grid;
  }

  throw new Error("Please upload a .csv or .xlsx file");
}
