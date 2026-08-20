import { describe, expect, it } from "vitest";
import {
  calculateCollectionRate,
  currentPeriod,
  formatPeriodLabel,
  periodKey,
  shiftPeriod,
  summarizeDues,
} from "./dues";

describe("periodKey", () => {
  it("formats as the first of the month, zero-padded", () => {
    expect(periodKey(new Date(2026, 7, 19))).toBe("2026-08-01"); // August, 0-indexed
    expect(periodKey(new Date(2026, 0, 5))).toBe("2026-01-01");
  });
});

describe("currentPeriod", () => {
  it("matches periodKey(now)", () => {
    expect(currentPeriod()).toBe(periodKey(new Date()));
  });
});

describe("shiftPeriod", () => {
  it("moves forward within a year", () => {
    expect(shiftPeriod("2026-08-01", 1)).toBe("2026-09-01");
  });

  it("moves backward within a year", () => {
    expect(shiftPeriod("2026-08-01", -1)).toBe("2026-07-01");
  });

  it("rolls over a year boundary going forward", () => {
    expect(shiftPeriod("2026-12-01", 1)).toBe("2027-01-01");
  });

  it("rolls over a year boundary going backward", () => {
    expect(shiftPeriod("2026-01-01", -1)).toBe("2025-12-01");
  });

  it("is a no-op with delta 0", () => {
    expect(shiftPeriod("2026-08-01", 0)).toBe("2026-08-01");
  });
});

describe("formatPeriodLabel", () => {
  it("reads as a human month/year", () => {
    expect(formatPeriodLabel("2026-08-01")).toBe("August 2026");
  });
});

describe("calculateCollectionRate", () => {
  it("is 100 when there are no charges at all", () => {
    expect(calculateCollectionRate([])).toBe(100);
  });

  it("is 100 when every charge is waived (nothing outstanding)", () => {
    expect(
      calculateCollectionRate([
        { status: "waived", amount_due: 300 },
        { status: "waived", amount_due: 300 },
      ]),
    ).toBe(100);
  });

  it("computes paid / (paid + unpaid) for a normal mix", () => {
    const rate = calculateCollectionRate([
      { status: "paid", amount_due: 300 },
      { status: "paid", amount_due: 300 },
      { status: "unpaid", amount_due: 400 },
    ]);
    // 600 paid / 1000 total = 60%
    expect(rate).toBeCloseTo(60);
  });

  it("excludes waived charges from both numerator and denominator", () => {
    const withoutWaived = calculateCollectionRate([
      { status: "paid", amount_due: 300 },
      { status: "unpaid", amount_due: 300 },
    ]);
    const withWaived = calculateCollectionRate([
      { status: "paid", amount_due: 300 },
      { status: "unpaid", amount_due: 300 },
      { status: "waived", amount_due: 1_000_000 }, // would swamp the rate if counted
    ]);
    expect(withWaived).toBeCloseTo(withoutWaived);
    expect(withWaived).toBeCloseTo(50);
  });

  it("is 0 when nothing has been paid", () => {
    expect(
      calculateCollectionRate([
        { status: "unpaid", amount_due: 300 },
        { status: "unpaid", amount_due: 300 },
      ]),
    ).toBe(0);
  });

  it("is 100 when everything counted has been paid", () => {
    expect(
      calculateCollectionRate([
        { status: "paid", amount_due: 300 },
        { status: "paid", amount_due: 300 },
      ]),
    ).toBe(100);
  });
});

describe("summarizeDues", () => {
  it("totals collected and outstanding, and counts overdue units, from a mix", () => {
    const summary = summarizeDues([
      { status: "paid", amount_due: 300 },
      { status: "paid", amount_due: 300 },
      { status: "unpaid", amount_due: 250 },
      { status: "unpaid", amount_due: 250 },
      { status: "waived", amount_due: 999 },
    ]);
    expect(summary.totalCollected).toBe(600);
    expect(summary.totalOutstanding).toBe(500);
    expect(summary.overdueCount).toBe(2);
    // billedCount includes the waived charge — it was billed, just forgiven.
    expect(summary.billedCount).toBe(5);
    expect(summary.collectionRate).toBeCloseTo(600 / (600 + 500) * 100);
  });

  it("is all zeros with a 100% collection rate when nothing has been billed", () => {
    const summary = summarizeDues([]);
    expect(summary.totalCollected).toBe(0);
    expect(summary.totalOutstanding).toBe(0);
    expect(summary.overdueCount).toBe(0);
    expect(summary.billedCount).toBe(0);
    expect(summary.collectionRate).toBe(100);
  });

  it("a waived-only period bills the unit but never counts it as overdue", () => {
    const summary = summarizeDues([{ status: "waived", amount_due: 400 }]);
    expect(summary.overdueCount).toBe(0);
    expect(summary.totalOutstanding).toBe(0);
    expect(summary.billedCount).toBe(1);
  });
});
