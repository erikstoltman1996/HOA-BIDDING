import { describe, expect, it } from "vitest";
import { summarizeExpenses } from "./expenses";

describe("summarizeExpenses", () => {
  it("sums only the entered amounts", () => {
    const summary = summarizeExpenses([{ amount: 100 }, { amount: 250 }, { amount: null }]);
    expect(summary.totalThisPeriod).toBe(350);
  });

  it("counts categoriesEntered vs totalCategories separately", () => {
    const summary = summarizeExpenses([{ amount: 100 }, { amount: null }, { amount: null }]);
    expect(summary.categoriesEntered).toBe(1);
    expect(summary.totalCategories).toBe(3);
  });

  it("is all zero with no categories", () => {
    const summary = summarizeExpenses([]);
    expect(summary).toEqual({ totalThisPeriod: 0, categoriesEntered: 0, totalCategories: 0 });
  });

  it("treats a $0 entry as entered, distinct from not-yet-entered", () => {
    const summary = summarizeExpenses([{ amount: 0 }, { amount: null }]);
    expect(summary.categoriesEntered).toBe(1);
    expect(summary.totalThisPeriod).toBe(0);
  });
});
