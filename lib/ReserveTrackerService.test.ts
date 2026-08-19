import { describe, expect, it } from "vitest";
import {
  ReserveTrackerService,
  type CommunityAsset,
  type ReserveTrackerInputs,
} from "./ReserveTrackerService";

function baseInputs(overrides: Partial<ReserveTrackerInputs> = {}): ReserveTrackerInputs {
  return {
    currentReserveBalance: 100_000,
    assets: [],
    newExpenditure: { description: "none", amount: 0 },
    ...overrides,
  };
}

describe("ReserveTrackerService", () => {
  describe("basic projection shape", () => {
    it("returns one outlook entry per projection year, defaulting to 10", () => {
      const service = new ReserveTrackerService();
      const result = service.calculate(baseInputs());
      expect(result.outlook).toHaveLength(10);
      expect(result.outlook.map((o) => o.year)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it("respects a custom projectionYears", () => {
      const service = new ReserveTrackerService();
      const result = service.calculate(baseInputs({ projectionYears: 3 }));
      expect(result.outlook).toHaveLength(3);
    });

    it("with no assets and no expenditure, balance never changes and stays 100% funded", () => {
      const service = new ReserveTrackerService();
      const result = service.calculate(baseInputs());
      result.outlook.forEach((year) => {
        expect(year.startingBalance).toBe(100_000);
        expect(year.endingBalance).toBe(100_000);
        expect(year.fullyFundedBalance).toBe(0);
        expect(year.percentFunded).toBe(100);
      });
      expect(result.alert).toBe(false);
      expect(result.firstAlertYear).toBeNull();
      expect(result.currentPercentFunded).toBe(100);
    });
  });

  describe("scheduled asset replacement", () => {
    const roof: CommunityAsset = {
      id: "roof",
      name: "Clubhouse Roof",
      expectedLifespanYears: 5,
      replacementCost: 20_000,
      currentAgeYears: 4,
    };

    it("deducts the replacement cost in the year the asset comes due", () => {
      const service = new ReserveTrackerService();
      const result = service.calculate(baseInputs({ assets: [roof] }));

      // Age 4 + 1 year of projection = 5 = lifespan, so it's due in year 0.
      expect(result.outlook[0].scheduledReplacementCost).toBe(20_000);
      expect(result.outlook[0].assetsReplacedThisYear).toEqual(["Clubhouse Roof"]);
      expect(result.outlook[0].endingBalance).toBe(80_000);

      // Resets to age 0 after replacement, so it shouldn't come due again
      // within a 5-year lifespan inside a 10-year window until year 5.
      expect(result.outlook[1].scheduledReplacementCost).toBe(0);
      expect(result.outlook[4].scheduledReplacementCost).toBe(0);
      expect(result.outlook[5].scheduledReplacementCost).toBe(20_000);
    });

    it("replaces a short-lived asset multiple times within the projection window", () => {
      const poolPump: CommunityAsset = {
        id: "pump",
        name: "Pool Pump",
        expectedLifespanYears: 4,
        replacementCost: 3_000,
        currentAgeYears: 0,
      };
      const service = new ReserveTrackerService();
      const result = service.calculate(baseInputs({ assets: [poolPump] }));

      const replacementYears = result.outlook
        .filter((y) => y.scheduledReplacementCost > 0)
        .map((y) => y.year);
      expect(replacementYears).toEqual([3, 7]);
    });

    it("computes fullyFundedBalance as replacementCost scaled by age/lifespan", () => {
      const asset: CommunityAsset = {
        id: "a",
        name: "Fence",
        expectedLifespanYears: 10,
        replacementCost: 10_000,
        currentAgeYears: 0,
      };
      const service = new ReserveTrackerService();
      const result = service.calculate(baseInputs({ assets: [asset], currentReserveBalance: 10_000 }));

      // After 1 projected year, age 1/10 of the way through its life.
      expect(result.outlook[0].fullyFundedBalance).toBeCloseTo(1_000, 5);
      // After 5 years, halfway funded ideally.
      expect(result.outlook[4].fullyFundedBalance).toBeCloseTo(5_000, 5);
    });
  });

  describe("unplanned expenditure", () => {
    it("applies in year 0 by default", () => {
      const service = new ReserveTrackerService();
      const result = service.calculate(
        baseInputs({ newExpenditure: { description: "Early roof repair", amount: 15_000 } }),
      );
      expect(result.outlook[0].unplannedExpenditure).toBe(15_000);
      expect(result.outlook[0].endingBalance).toBe(85_000);
      expect(result.outlook[1].unplannedExpenditure).toBe(0);
    });

    it("applies only in the specified yearIndex", () => {
      const service = new ReserveTrackerService();
      const result = service.calculate(
        baseInputs({
          newExpenditure: { description: "Future deck repair", amount: 5_000, yearIndex: 3 },
        }),
      );
      expect(result.outlook[0].unplannedExpenditure).toBe(0);
      expect(result.outlook[2].unplannedExpenditure).toBe(0);
      expect(result.outlook[3].unplannedExpenditure).toBe(5_000);
      expect(result.outlook[3].endingBalance).toBe(95_000);
      expect(result.outlook[4].unplannedExpenditure).toBe(0);
    });

    it("resets the linked asset's age when assetId is provided", () => {
      const deck: CommunityAsset = {
        id: "deck-b",
        name: "Building B Decks",
        expectedLifespanYears: 15,
        replacementCost: 40_000,
        currentAgeYears: 8,
      };
      const service = new ReserveTrackerService();
      const result = service.calculate(
        baseInputs({
          assets: [deck],
          currentReserveBalance: 100_000,
          newExpenditure: {
            description: "Emergency deck replacement",
            amount: 40_000,
            yearIndex: 0,
            assetId: "deck-b",
          },
        }),
      );

      // Age resets to 0 at year 0, so it shouldn't be scheduled again until
      // year 15 — well outside a 10-year window.
      const scheduledLater = result.outlook.slice(1).every((y) => y.scheduledReplacementCost === 0);
      expect(scheduledLater).toBe(true);
      expect(result.outlook[9].fullyFundedBalance).toBeCloseTo((40_000 * 9) / 15, 5);
    });
  });

  describe("annual contribution", () => {
    it("defaults to 0 — a pure depletion projection", () => {
      const service = new ReserveTrackerService();
      const result = service.calculate(
        baseInputs({ newExpenditure: { description: "x", amount: 10_000 } }),
      );
      expect(result.outlook[0].contributions).toBe(0);
      expect(result.outlook[9].endingBalance).toBe(90_000);
    });

    it("accumulates over the projection when supplied", () => {
      const service = new ReserveTrackerService();
      const result = service.calculate(baseInputs({ annualContribution: 5_000 }));
      expect(result.outlook[0].endingBalance).toBe(105_000);
      expect(result.outlook[9].endingBalance).toBe(150_000);
    });
  });

  describe("alert flag", () => {
    const asset: CommunityAsset = {
      id: "roof",
      name: "Roof",
      expectedLifespanYears: 20,
      replacementCost: 200_000,
      currentAgeYears: 10,
    };

    it("is false when percentFunded never drops below the threshold", () => {
      const service = new ReserveTrackerService();
      const result = service.calculate(
        baseInputs({ assets: [asset], currentReserveBalance: 100_000, annualContribution: 5_000 }),
      );
      expect(result.alert).toBe(false);
      expect(result.firstAlertYear).toBeNull();
    });

    it("is true and records the first breaching year when funding falls below the default 70% threshold", () => {
      const service = new ReserveTrackerService();
      const result = service.calculate(
        baseInputs({
          assets: [asset],
          currentReserveBalance: 20_000,
          newExpenditure: { description: "Unplanned HVAC failure", amount: 15_000 },
        }),
      );
      expect(result.alert).toBe(true);
      expect(result.firstAlertYear).toBe(0);
      expect(result.outlook[0].percentFunded).toBeLessThan(70);
    });

    it("respects a custom alertThresholdPercent", () => {
      const service = new ReserveTrackerService();
      const lenient = service.calculate(
        baseInputs({
          assets: [asset],
          currentReserveBalance: 20_000,
          newExpenditure: { description: "x", amount: 15_000 },
          alertThresholdPercent: 1,
        }),
      );
      expect(lenient.alert).toBe(false);

      const strict = service.calculate(
        baseInputs({
          assets: [asset],
          currentReserveBalance: 90_000,
          alertThresholdPercent: 95,
        }),
      );
      expect(strict.alert).toBe(true);
    });

    it("a constructor-level threshold applies when the call doesn't override it", () => {
      const strictService = new ReserveTrackerService({ alertThresholdPercent: 99 });
      const result = strictService.calculate(
        baseInputs({ assets: [asset], currentReserveBalance: 100_000, annualContribution: 5_000 }),
      );
      expect(result.alert).toBe(true);
    });
  });

  describe("currentPercentFunded", () => {
    it("reflects today's funding level, independent of the projection", () => {
      const asset: CommunityAsset = {
        id: "a",
        name: "Roof",
        expectedLifespanYears: 10,
        replacementCost: 10_000,
        currentAgeYears: 5,
      };
      const service = new ReserveTrackerService();
      const result = service.calculate(baseInputs({ assets: [asset], currentReserveBalance: 5_000 }));
      // Ideal at 5/10 years in: $5,000. Balance is $5,000 → 100% funded today.
      expect(result.currentPercentFunded).toBe(100);
    });
  });

  describe("validation", () => {
    it("throws on a non-finite reserve balance", () => {
      const service = new ReserveTrackerService();
      expect(() => service.calculate(baseInputs({ currentReserveBalance: NaN }))).toThrow(
        /currentReserveBalance/,
      );
    });

    it("throws on an asset with a non-positive lifespan", () => {
      const service = new ReserveTrackerService();
      const badAsset: CommunityAsset = {
        id: "x",
        name: "Broken Asset",
        expectedLifespanYears: 0,
        replacementCost: 1_000,
        currentAgeYears: 0,
      };
      expect(() => service.calculate(baseInputs({ assets: [badAsset] }))).toThrow(/expectedLifespanYears/);
    });

    it("throws on a negative replacement cost", () => {
      const service = new ReserveTrackerService();
      const badAsset: CommunityAsset = {
        id: "x",
        name: "Broken Asset",
        expectedLifespanYears: 5,
        replacementCost: -1,
        currentAgeYears: 0,
      };
      expect(() => service.calculate(baseInputs({ assets: [badAsset] }))).toThrow(/replacementCost/);
    });

    it("throws on a negative unplanned expenditure amount", () => {
      const service = new ReserveTrackerService();
      expect(() =>
        service.calculate(baseInputs({ newExpenditure: { description: "x", amount: -1 } })),
      ).toThrow(/newExpenditure/);
    });

    it("throws on a non-positive projectionYears", () => {
      const service = new ReserveTrackerService();
      expect(() => service.calculate(baseInputs({ projectionYears: 0 }))).toThrow(/projectionYears/);
    });
  });
});
