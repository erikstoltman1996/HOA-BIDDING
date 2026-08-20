import { describe, expect, it } from "vitest";
import {
  calculateCollectionRate,
  currentPeriod,
  formatPeriodLabel,
  periodKey,
  shiftPeriod,
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
