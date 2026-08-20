import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("joins headers and rows with commas and CRLF", () => {
    expect(toCsv(["A", "B"], [["1", "2"], ["3", "4"]])).toBe("A,B\r\n1,2\r\n3,4");
  });

  it("quotes and escapes a field containing a comma", () => {
    expect(toCsv(["Name"], [["Smith, John"]])).toBe('Name\r\n"Smith, John"');
  });

  it("quotes and doubles internal quotes", () => {
    expect(toCsv(["Note"], [['He said "hi"']])).toBe('Note\r\n"He said ""hi"""');
  });

  it("quotes a field containing a newline", () => {
    expect(toCsv(["Note"], [["line1\nline2"]])).toBe('Note\r\n"line1\nline2"');
  });

  it("renders null/undefined as an empty cell", () => {
    expect(toCsv(["A", "B"], [[null, undefined]])).toBe("A,B\r\n,");
  });

  it("leaves plain numbers and text unquoted", () => {
    expect(toCsv(["Amount"], [[300]])).toBe("Amount\r\n300");
  });
});
