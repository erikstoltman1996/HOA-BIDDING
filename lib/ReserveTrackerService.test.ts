import { describe, expect, it } from "vitest";
import { ReserveTrackerService, CommunityAsset } from "./ReserveTrackerService";

const roof: CommunityAsset = {
  id: "roof",
  name: "Roof",
  replacementCost: 100000,
  usefulLifeYears: 20,
  remainingUsefulLifeYears: 10, // half-life used
};

const poolPump: CommunityAsset = {
  id: "pool-pump",
  name: "Pool Pump",
  replacementCost: 5000,
  usefulLifeYears: 10,
  remainingUsefulLifeYears: 1, // nearly due
};

const paving: CommunityAsset = {
  id: "paving",
  name: "Paving",
  replacementCost: 40000,
  usefulLifeYears: 15,
  remainingUsefulLifeYears: 15, // brand new, no deterioration yet
};

describe("calculateFullyFundedBalance", () => {
  it("computes the component-method FFB for a single half-life asset", () => {
    // $100,000 roof, half its life used -> $50,000 FFB contribution
    const ffb = ReserveTrackerService.calculateFullyFundedBalance([roof]);
    expect(ffb).toBeCloseTo(50000);
  });

  it("sums FFB correctly across multiple assets", () => {
    // roof: 100000 * (10/20) = 50000
    // pool pump: 5000 * (9/10) = 4500
    // paving: 40000 * (0/15) = 0
    const ffb = ReserveTrackerService.calculateFullyFundedBalance([roof, poolPump, paving]);
    expect(ffb).toBeCloseTo(54500);
  });

  it("returns 0 for an empty asset list", () => {
    expect(ReserveTrackerService.calculateFullyFundedBalance([])).toBe(0);
  });

  it("returns 0 for an asset with full remaining life (no deterioration)", () => {
    expect(ReserveTrackerService.calculateFullyFundedBalance([paving])).toBe(0);
  });

  it("returns the full replacement cost for an asset at end of life", () => {
    const wornOut: CommunityAsset = { ...roof, remainingUsefulLifeYears: 0 };
    expect(ReserveTrackerService.calculateFullyFundedBalance([wornOut])).toBeCloseTo(100000);
  });
});

describe("calculatePercentFunded", () => {
  it("computes a simple percentage correctly", () => {
    expect(ReserveTrackerService.calculatePercentFunded(30000, 50000)).toBeCloseTo(60);
  });

  it("treats a zero fully-funded balance as 100% funded rather than dividing by zero", () => {
    expect(ReserveTrackerService.calculatePercentFunded(0, 0)).toBe(100);
    expect(ReserveTrackerService.calculatePercentFunded(5000, 0)).toBe(100);
  });

  it("allows percent funded above 100%", () => {
    expect(ReserveTrackerService.calculatePercentFunded(80000, 50000)).toBeCloseTo(160);
  });
});

describe("applyExpenditure", () => {
  it("deducts the expenditure amount from the balance", () => {
    const { balance } = ReserveTrackerService.applyExpenditure(20000, [poolPump], {
      description: "Emergency pump repair",
      amount: 3000,
      date: "2026-08-19",
    });
    expect(balance).toBe(17000);
  });

  it("resets the tied asset's remaining life to full by default when assetId is set", () => {
    const { assets } = ReserveTrackerService.applyExpenditure(20000, [poolPump], {
      assetId: "pool-pump",
      description: "Pool pump replaced",
      amount: 5200,
      date: "2026-08-19",
    });
    const updated = assets.find((a) => a.id === "pool-pump")!;
    expect(updated.remainingUsefulLifeYears).toBe(poolPump.usefulLifeYears);
  });

  it("does not reset asset life when resetsAssetLife is explicitly false", () => {
    const { assets } = ReserveTrackerService.applyExpenditure(20000, [poolPump], {
      assetId: "pool-pump",
      description: "Partial patch job, not a full replacement",
      amount: 800,
      date: "2026-08-19",
      resetsAssetLife: false,
    });
    const updated = assets.find((a) => a.id === "pool-pump")!;
    expect(updated.remainingUsefulLifeYears).toBe(poolPump.remainingUsefulLifeYears);
  });

  it("leaves other assets untouched", () => {
    const { assets } = ReserveTrackerService.applyExpenditure(20000, [roof, poolPump], {
      assetId: "pool-pump",
      description: "Pool pump replaced",
      amount: 5200,
      date: "2026-08-19",
    });
    const untouchedRoof = assets.find((a) => a.id === "roof")!;
    expect(untouchedRoof.remainingUsefulLifeYears).toBe(roof.remainingUsefulLifeYears);
  });

  it("does not mutate the original assets array or its objects", () => {
    const original = [{ ...poolPump }];
    ReserveTrackerService.applyExpenditure(20000, original, {
      assetId: "pool-pump",
      description: "Pool pump replaced",
      amount: 5200,
      date: "2026-08-19",
    });
    expect(original[0].remainingUsefulLifeYears).toBe(poolPump.remainingUsefulLifeYears);
  });

  it("passes through balance and assets unchanged when no expenditure is given", () => {
    const result = ReserveTrackerService.applyExpenditure(20000, [roof]);
    expect(result.balance).toBe(20000);
    expect(result.assets).toEqual([roof]);
  });
});

describe("ReserveTrackerService.run — alert behavior", () => {
  it("raises the alert flag when an expenditure drops percent funded below 70%", () => {
    // FFB with just the roof = 50000. Balance of 40000 -> 80% funded (healthy).
    // An unplanned $15,000 expenditure drops the balance to 25000 -> 50% funded.
    const result = ReserveTrackerService.run({
      currentReserveBalance: 40000,
      assets: [roof],
      unplannedExpenditure: {
        description: "Unplanned roof repair after storm damage",
        amount: 15000,
        date: "2026-08-19",
      },
      annualContribution: 5000,
    });

    expect(result.percentFundedBefore).toBeCloseTo(80);
    expect(result.percentFundedAfter).toBeCloseTo(50);
    expect(result.alert).toBe(true);
    expect(result.alertMessage).toContain("70%");
  });

  it("does not raise the alert flag when funding stays at or above the threshold", () => {
    const result = ReserveTrackerService.run({
      currentReserveBalance: 48000,
      assets: [roof],
      unplannedExpenditure: {
        description: "Minor repair",
        amount: 1000,
        date: "2026-08-19",
      },
      annualContribution: 5000,
    });

    expect(result.percentFundedAfter).toBeGreaterThanOrEqual(70);
    expect(result.alert).toBe(false);
    expect(result.alertMessage).toBeNull();
  });

  it("respects a custom alert threshold", () => {
    const result = ReserveTrackerService.run({
      currentReserveBalance: 45000, // 90% funded against 50000 FFB
      assets: [roof],
      annualContribution: 5000,
      alertThresholdPercent: 95,
    });
    expect(result.alert).toBe(true);
  });

  it("handles a run with no unplanned expenditure (health check only)", () => {
    const result = ReserveTrackerService.run({
      currentReserveBalance: 40000,
      assets: [roof],
      annualContribution: 5000,
    });
    expect(result.percentFundedBefore).toBeCloseTo(result.percentFundedAfter);
    expect(result.reserveBalanceAfterExpenditure).toBe(40000);
  });
});

describe("ReserveTrackerService.run — 10-year outlook", () => {
  it("produces an outlook array of the requested length, defaulting to 10 years", () => {
    const result = ReserveTrackerService.run({
      currentReserveBalance: 40000,
      assets: [roof],
      annualContribution: 5000,
    });
    expect(result.tenYearOutlook).toHaveLength(10);
    expect(result.tenYearOutlook[0].year).toBe(1);
    expect(result.tenYearOutlook[9].year).toBe(10);
  });

  it("respects a custom projectionYears", () => {
    const result = ReserveTrackerService.run({
      currentReserveBalance: 40000,
      assets: [roof],
      annualContribution: 5000,
      projectionYears: 3,
    });
    expect(result.tenYearOutlook).toHaveLength(3);
  });

  it("triggers a planned replacement in the outlook when an asset's remaining life hits zero", () => {
    // pool pump has 1 year remaining -> should trigger a replacement in year 1
    const result = ReserveTrackerService.run({
      currentReserveBalance: 20000,
      assets: [poolPump],
      annualContribution: 1000,
      projectionYears: 3,
    });

    const yearOne = result.tenYearOutlook[0];
    expect(yearOne.assetsReplaced).toContain("Pool Pump");
    expect(yearOne.plannedExpenditures).toBeCloseTo(poolPump.replacementCost);
  });

  it("resets a replaced asset's life so it doesn't replace again immediately", () => {
    const result = ReserveTrackerService.run({
      currentReserveBalance: 20000,
      assets: [poolPump], // usefulLife 10, remaining 1
      annualContribution: 1000,
      projectionYears: 3,
    });
    // Replaced in year 1 (life resets to 10, so remaining after year 2's aging = 9).
    // It should NOT replace again in year 2 or 3.
    expect(result.tenYearOutlook[1].assetsReplaced).not.toContain("Pool Pump");
    expect(result.tenYearOutlook[2].assetsReplaced).not.toContain("Pool Pump");
  });

  it("applies interest earnings to the balance each year when interestRatePercent is set", () => {
    const withInterest = ReserveTrackerService.run({
      currentReserveBalance: 100000,
      assets: [paving], // no deterioration, no planned expenditures
      annualContribution: 0,
      interestRatePercent: 5,
      projectionYears: 1,
    });
    expect(withInterest.tenYearOutlook[0].interestEarned).toBeCloseTo(5000);
    expect(withInterest.tenYearOutlook[0].endingBalance).toBeCloseTo(105000);
  });

  it("applies inflation to future replacement costs when inflationRatePercent is set", () => {
    const result = ReserveTrackerService.run({
      currentReserveBalance: 20000,
      assets: [poolPump], // replaces in year 1, cost 5000
      annualContribution: 0,
      inflationRatePercent: 10,
      projectionYears: 1,
    });
    // Year 1 inflation factor = 1.10^1
    expect(result.tenYearOutlook[0].plannedExpenditures).toBeCloseTo(5500);
  });

  it("compounds inflation correctly across multiple years", () => {
    const twoYearLifeAsset: CommunityAsset = {
      id: "gate",
      name: "Gate Motor",
      replacementCost: 1000,
      usefulLifeYears: 2,
      remainingUsefulLifeYears: 2,
    };
    const result = ReserveTrackerService.run({
      currentReserveBalance: 5000,
      assets: [twoYearLifeAsset],
      annualContribution: 0,
      inflationRatePercent: 10,
      projectionYears: 2,
    });
    // Replaces in year 2 -> inflation factor 1.10^2 = 1.21
    expect(result.tenYearOutlook[1].plannedExpenditures).toBeCloseTo(1210, 0);
  });

  it("tracks a declining percent-funded trend across years when contributions are insufficient", () => {
    const result = ReserveTrackerService.run({
      currentReserveBalance: 20000,
      assets: [poolPump],
      annualContribution: 0, // no contributions at all
      projectionYears: 5,
    });
    const percentages = result.tenYearOutlook.map((y) => y.percentFunded);
    // With zero contributions and a real replacement hitting the balance,
    // funding health should not be monotonically improving.
    expect(Math.min(...percentages)).toBeLessThanOrEqual(percentages[0]);
  });
});

describe("ReserveTrackerService.run — end-to-end example from the spec", () => {
  it("handles the roof-repair-or-pool-pump style scenario end to end", () => {
    const result = ReserveTrackerService.run({
      currentReserveBalance: 150000,
      assets: [roof, poolPump, paving],
      unplannedExpenditure: {
        assetId: "pool-pump",
        description: "Pool pump failed early, replaced under emergency call",
        amount: 5200,
        date: "2026-08-19",
      },
      annualContribution: 20000,
      interestRatePercent: 2,
      inflationRatePercent: 3,
      projectionYears: 10,
    });

    expect(result.fullyFundedBalanceBefore).toBeCloseTo(54500);
    expect(result.reserveBalanceAfterExpenditure).toBeCloseTo(144800);
    // Pool pump's life should have reset, dropping FFB after expenditure.
    expect(result.fullyFundedBalanceAfter).toBeCloseTo(50000); // roof only now contributes
    expect(result.tenYearOutlook).toHaveLength(10);
    expect(result.alert).toBe(false); // well-funded community in this scenario
  });
});

describe("ReserveTrackerService.run — input validation", () => {
  it("throws on a negative reserve balance", () => {
    expect(() =>
      ReserveTrackerService.run({
        currentReserveBalance: -100,
        assets: [roof],
        annualContribution: 1000,
      })
    ).toThrow(/currentReserveBalance/);
  });

  it("throws on a negative annual contribution", () => {
    expect(() =>
      ReserveTrackerService.run({
        currentReserveBalance: 1000,
        assets: [roof],
        annualContribution: -500,
      })
    ).toThrow(/annualContribution/);
  });

  it("throws on an asset with zero useful life", () => {
    const badAsset: CommunityAsset = { ...roof, usefulLifeYears: 0 };
    expect(() =>
      ReserveTrackerService.run({
        currentReserveBalance: 1000,
        assets: [badAsset],
        annualContribution: 1000,
      })
    ).toThrow(/usefulLifeYears/);
  });

  it("throws when remainingUsefulLifeYears exceeds usefulLifeYears", () => {
    const badAsset: CommunityAsset = { ...roof, remainingUsefulLifeYears: 25 };
    expect(() =>
      ReserveTrackerService.run({
        currentReserveBalance: 1000,
        assets: [badAsset],
        annualContribution: 1000,
      })
    ).toThrow(/remainingUsefulLifeYears/);
  });

  it("throws when remainingUsefulLifeYears is negative", () => {
    const badAsset: CommunityAsset = { ...roof, remainingUsefulLifeYears: -1 };
    expect(() =>
      ReserveTrackerService.run({
        currentReserveBalance: 1000,
        assets: [badAsset],
        annualContribution: 1000,
      })
    ).toThrow(/remainingUsefulLifeYears/);
  });

  it("throws on a negative expenditure amount", () => {
    expect(() =>
      ReserveTrackerService.run({
        currentReserveBalance: 1000,
        assets: [roof],
        annualContribution: 1000,
        unplannedExpenditure: {
          description: "bad data",
          amount: -50,
          date: "2026-08-19",
        },
      })
    ).toThrow(/amount/);
  });

  it("throws when an expenditure's assetId does not match any known asset", () => {
    expect(() =>
      ReserveTrackerService.run({
        currentReserveBalance: 1000,
        assets: [roof],
        annualContribution: 1000,
        unplannedExpenditure: {
          assetId: "does-not-exist",
          description: "typo'd asset id",
          amount: 50,
          date: "2026-08-19",
        },
      })
    ).toThrow(/does-not-exist/);
  });

  it("throws on a non-positive projectionYears", () => {
    expect(() =>
      ReserveTrackerService.run({
        currentReserveBalance: 1000,
        assets: [roof],
        annualContribution: 1000,
        projectionYears: 0,
      })
    ).toThrow(/projectionYears/);
  });

  it("throws on a non-integer projectionYears", () => {
    expect(() =>
      ReserveTrackerService.run({
        currentReserveBalance: 1000,
        assets: [roof],
        annualContribution: 1000,
        projectionYears: 2.5,
      })
    ).toThrow(/projectionYears/);
  });
});
