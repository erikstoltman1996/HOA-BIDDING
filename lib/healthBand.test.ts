import { describe, expect, it } from "vitest";
import {
  DUES_COLLECTION_THRESHOLDS,
  healthBand,
  healthBandColor,
  RESERVE_FUND_THRESHOLDS,
} from "./healthBand";

describe("healthBand with default (reserve fund) thresholds", () => {
  it("is good at and above 70", () => {
    expect(healthBand(70)).toBe("good");
    expect(healthBand(100)).toBe("good");
  });

  it("is fair between 30 and 70", () => {
    expect(healthBand(30)).toBe("fair");
    expect(healthBand(69.9)).toBe("fair");
  });

  it("is risk below 30", () => {
    expect(healthBand(29.9)).toBe("risk");
    expect(healthBand(0)).toBe("risk");
  });
});

describe("healthBand with dues-collection thresholds", () => {
  it("is good at and above 95 — near-full collection is the normal bar, not 70", () => {
    expect(healthBand(95, DUES_COLLECTION_THRESHOLDS)).toBe("good");
    expect(healthBand(100, DUES_COLLECTION_THRESHOLDS)).toBe("good");
  });

  it("is fair between 85 and 95", () => {
    expect(healthBand(85, DUES_COLLECTION_THRESHOLDS)).toBe("fair");
    expect(healthBand(94.9, DUES_COLLECTION_THRESHOLDS)).toBe("fair");
  });

  it("is risk below 85 — a rate that would be 'good' for reserves is a delinquency problem for dues", () => {
    expect(healthBand(84.9, DUES_COLLECTION_THRESHOLDS)).toBe("risk");
    expect(healthBand(70, DUES_COLLECTION_THRESHOLDS)).toBe("risk");
  });

  it("thresholds are independent — the same percent can land in different bands per metric", () => {
    expect(healthBand(75, RESERVE_FUND_THRESHOLDS)).toBe("good");
    expect(healthBand(75, DUES_COLLECTION_THRESHOLDS)).toBe("risk");
  });
});

describe("healthBandColor", () => {
  it("returns a distinct color per band", () => {
    const good = healthBandColor(100);
    const fair = healthBandColor(50);
    const risk = healthBandColor(0);
    expect(new Set([good, fair, risk]).size).toBe(3);
  });

  it("respects custom thresholds the same way healthBand does", () => {
    expect(healthBandColor(90, DUES_COLLECTION_THRESHOLDS)).toBe(healthBandColor(50, RESERVE_FUND_THRESHOLDS));
  });
});
