/**
 * ReserveTrackerService
 * ----------------------
 * Tracks an HOA's capital reserve fund health using the industry-standard
 * "component method" for calculating a Fully Funded Balance (FFB), and
 * recalculates that health whenever an unplanned expenditure occurs.
 *
 * Methodology reference: National Reserve Study Standards (component method).
 *   Fully Funded Balance = sum over all assets of:
 *     replacementCost * (elapsedLifeYears / usefulLifeYears)
 *   Percent Funded = currentReserveBalance / fullyFundedBalance * 100
 *
 * Industry-cited health bands (not a legal standard, just common practice):
 *   70-100%+  healthy
 *   30-70%    fair / catch-up plan usually needed
 *   0-30%     underfunded / high special-assessment risk
 *
 * This service defaults its alert threshold to 70%, matching that
 * convention, but it's configurable per call.
 */

export interface CommunityAsset {
  /** Stable identifier for this component (roof, pool pump, elevator, etc). */
  id: string;
  name: string;
  /** Cost to replace this component today, in current dollars. Must be >= 0. */
  replacementCost: number;
  /** Total expected lifespan of the component when new, in years. Must be > 0. */
  usefulLifeYears: number;
  /**
   * Years remaining before this component is due for replacement.
   * Must be between 0 and usefulLifeYears (inclusive).
   */
  remainingUsefulLifeYears: number;
}

export interface UnplannedExpenditure {
  /** If this expenditure replaces/repairs a tracked asset, its id. */
  assetId?: string;
  description: string;
  /** Dollar amount spent. Must be >= 0. */
  amount: number;
  /** ISO date string (e.g. "2026-08-19") the expenditure occurred. */
  date: string;
  /**
   * If true and assetId is set, the asset's remaining useful life resets
   * to its full usefulLifeYears (e.g. the pool pump was actually replaced,
   * not just patched). Defaults to true when assetId is present.
   */
  resetsAssetLife?: boolean;
}

export interface ReserveTrackerInput {
  /** Reserve fund balance before the unplanned expenditure, in dollars. */
  currentReserveBalance: number;
  assets: CommunityAsset[];
  /** The new unplanned expenditure being evaluated. Optional — omit to just
   * see the current health with no new spend. */
  unplannedExpenditure?: UnplannedExpenditure;
  /** Planned annual contribution to reserves, in dollars. Must be >= 0. */
  annualContribution: number;
  /** Annual interest rate earned on the reserve balance, as a percent (e.g. 2 for 2%). Default 0. */
  interestRatePercent?: number;
  /** Annual inflation rate applied to future replacement costs, as a percent. Default 0. */
  inflationRatePercent?: number;
  /** Number of years to project forward. Default 10. */
  projectionYears?: number;
  /** Percent-funded threshold below which the alert flag is raised. Default 70. */
  alertThresholdPercent?: number;
}

export interface YearProjection {
  /** 1-indexed year of the projection (year 1 = one year from now). */
  year: number;
  startingBalance: number;
  contributions: number;
  interestEarned: number;
  /** Total cost of components reaching end-of-life this year. */
  plannedExpenditures: number;
  endingBalance: number;
  fullyFundedBalance: number;
  percentFunded: number;
  belowThreshold: boolean;
  /** Names of assets replaced this year, if any. */
  assetsReplaced: string[];
}

export interface ReserveTrackerResult {
  fullyFundedBalanceBefore: number;
  percentFundedBefore: number;
  reserveBalanceAfterExpenditure: number;
  fullyFundedBalanceAfter: number;
  percentFundedAfter: number;
  /** True if percentFundedAfter is below the alert threshold. */
  alert: boolean;
  alertMessage: string | null;
  tenYearOutlook: YearProjection[];
}

const DEFAULT_PROJECTION_YEARS = 10;
const DEFAULT_ALERT_THRESHOLD_PERCENT = 70;

export class ReserveTrackerService {
  /**
   * Validates a single asset's fields. Throws a descriptive error on
   * anything that would make downstream math nonsensical.
   */
  private static validateAsset(asset: CommunityAsset): void {
    if (asset.replacementCost < 0) {
      throw new Error(
        `Asset "${asset.id}": replacementCost must be >= 0, got ${asset.replacementCost}`
      );
    }
    if (asset.usefulLifeYears <= 0) {
      throw new Error(
        `Asset "${asset.id}": usefulLifeYears must be > 0, got ${asset.usefulLifeYears}`
      );
    }
    if (
      asset.remainingUsefulLifeYears < 0 ||
      asset.remainingUsefulLifeYears > asset.usefulLifeYears
    ) {
      throw new Error(
        `Asset "${asset.id}": remainingUsefulLifeYears (${asset.remainingUsefulLifeYears}) ` +
          `must be between 0 and usefulLifeYears (${asset.usefulLifeYears})`
      );
    }
  }

  private static validateInput(input: ReserveTrackerInput): void {
    if (input.currentReserveBalance < 0) {
      throw new Error(
        `currentReserveBalance must be >= 0, got ${input.currentReserveBalance}`
      );
    }
    if (input.annualContribution < 0) {
      throw new Error(
        `annualContribution must be >= 0, got ${input.annualContribution}`
      );
    }
    if ((input.interestRatePercent ?? 0) < 0) {
      throw new Error(`interestRatePercent must be >= 0`);
    }
    if ((input.inflationRatePercent ?? 0) < 0) {
      throw new Error(`inflationRatePercent must be >= 0`);
    }
    const projectionYears = input.projectionYears ?? DEFAULT_PROJECTION_YEARS;
    if (!Number.isInteger(projectionYears) || projectionYears <= 0) {
      throw new Error(`projectionYears must be a positive integer`);
    }
    if (input.unplannedExpenditure) {
      if (input.unplannedExpenditure.amount < 0) {
        throw new Error(`unplannedExpenditure.amount must be >= 0`);
      }
      if (
        input.unplannedExpenditure.assetId &&
        !input.assets.some((a) => a.id === input.unplannedExpenditure!.assetId)
      ) {
        throw new Error(
          `unplannedExpenditure.assetId "${input.unplannedExpenditure.assetId}" ` +
            `does not match any asset in the provided list`
        );
      }
    }
    input.assets.forEach((asset) => ReserveTrackerService.validateAsset(asset));
  }

  /**
   * Component-method Fully Funded Balance: for each asset, the fraction of
   * its life already used, multiplied by its current replacement cost,
   * summed across all assets.
   */
  static calculateFullyFundedBalance(assets: CommunityAsset[]): number {
    return assets.reduce((total, asset) => {
      const elapsedLifeYears = asset.usefulLifeYears - asset.remainingUsefulLifeYears;
      const fractionUsed = elapsedLifeYears / asset.usefulLifeYears;
      return total + asset.replacementCost * fractionUsed;
    }, 0);
  }

  static calculatePercentFunded(
    reserveBalance: number,
    fullyFundedBalance: number
  ): number {
    if (fullyFundedBalance === 0) {
      // No accumulated deterioration yet (e.g. a brand-new community) —
      // treat as fully funded rather than dividing by zero.
      return 100;
    }
    return (reserveBalance / fullyFundedBalance) * 100;
  }

  /**
   * Applies an unplanned expenditure: deducts it from the reserve balance,
   * and — if it's tied to a tracked asset and resets that asset's life —
   * returns a new assets array with that asset's remaining life restored
   * to full. Never mutates the input array or its objects.
   */
  static applyExpenditure(
    reserveBalance: number,
    assets: CommunityAsset[],
    expenditure?: UnplannedExpenditure
  ): { balance: number; assets: CommunityAsset[] } {
    if (!expenditure) {
      return { balance: reserveBalance, assets };
    }

    const newBalance = reserveBalance - expenditure.amount;
    const shouldReset =
      expenditure.assetId != null && (expenditure.resetsAssetLife ?? true);

    const newAssets = assets.map((asset) => {
      if (shouldReset && asset.id === expenditure.assetId) {
        return { ...asset, remainingUsefulLifeYears: asset.usefulLifeYears };
      }
      return asset;
    });

    return { balance: newBalance, assets: newAssets };
  }

  /**
   * Projects reserve fund health forward year by year. Each year:
   *   1. Every asset ages by one year (remaining life -1).
   *   2. Any asset whose remaining life hits 0 triggers a planned
   *      replacement at its (optionally inflated) replacement cost, and
   *      its remaining life resets to its full useful life.
   *   3. The balance rolls forward: + contribution + interest - replacements.
   *   4. Percent funded is recalculated against the aged asset pool.
   */
  static projectOutlook(
    startingBalance: number,
    startingAssets: CommunityAsset[],
    options: {
      annualContribution: number;
      interestRatePercent: number;
      inflationRatePercent: number;
      projectionYears: number;
      alertThresholdPercent: number;
    }
  ): YearProjection[] {
    const {
      annualContribution,
      interestRatePercent,
      inflationRatePercent,
      projectionYears,
      alertThresholdPercent,
    } = options;

    let balance = startingBalance;
    // Deep-copy so we can age this working set independently of the input.
    let assets = startingAssets.map((a) => ({ ...a }));
    const interestRate = interestRatePercent / 100;
    const inflationRate = inflationRatePercent / 100;

    const outlook: YearProjection[] = [];

    for (let year = 1; year <= projectionYears; year++) {
      const startingYearBalance = balance;
      const inflationFactor = Math.pow(1 + inflationRate, year);

      let plannedExpenditures = 0;
      const assetsReplaced: string[] = [];

      assets = assets.map((asset) => {
        const agedRemainingLife = asset.remainingUsefulLifeYears - 1;
        if (agedRemainingLife <= 0) {
          plannedExpenditures += asset.replacementCost * inflationFactor;
          assetsReplaced.push(asset.name);
          return { ...asset, remainingUsefulLifeYears: asset.usefulLifeYears };
        }
        return { ...asset, remainingUsefulLifeYears: agedRemainingLife };
      });

      const interestEarned = startingYearBalance * interestRate;
      balance = startingYearBalance + annualContribution + interestEarned - plannedExpenditures;

      const fullyFundedBalance = ReserveTrackerService.calculateFullyFundedBalance(assets);
      const percentFunded = ReserveTrackerService.calculatePercentFunded(
        balance,
        fullyFundedBalance
      );

      outlook.push({
        year,
        startingBalance: startingYearBalance,
        contributions: annualContribution,
        interestEarned,
        plannedExpenditures,
        endingBalance: balance,
        fullyFundedBalance,
        percentFunded,
        belowThreshold: percentFunded < alertThresholdPercent,
        assetsReplaced,
      });
    }

    return outlook;
  }

  /**
   * Main entry point: given the current state and a new unplanned
   * expenditure, recalculates reserve health before/after and produces
   * a forward-looking outlook with an alert flag.
   */
  static run(input: ReserveTrackerInput): ReserveTrackerResult {
    ReserveTrackerService.validateInput(input);

    const projectionYears = input.projectionYears ?? DEFAULT_PROJECTION_YEARS;
    const alertThresholdPercent =
      input.alertThresholdPercent ?? DEFAULT_ALERT_THRESHOLD_PERCENT;
    const interestRatePercent = input.interestRatePercent ?? 0;
    const inflationRatePercent = input.inflationRatePercent ?? 0;

    const fullyFundedBalanceBefore = ReserveTrackerService.calculateFullyFundedBalance(
      input.assets
    );
    const percentFundedBefore = ReserveTrackerService.calculatePercentFunded(
      input.currentReserveBalance,
      fullyFundedBalanceBefore
    );

    const { balance: reserveBalanceAfterExpenditure, assets: assetsAfterExpenditure } =
      ReserveTrackerService.applyExpenditure(
        input.currentReserveBalance,
        input.assets,
        input.unplannedExpenditure
      );

    const fullyFundedBalanceAfter = ReserveTrackerService.calculateFullyFundedBalance(
      assetsAfterExpenditure
    );
    const percentFundedAfter = ReserveTrackerService.calculatePercentFunded(
      reserveBalanceAfterExpenditure,
      fullyFundedBalanceAfter
    );

    const alert = percentFundedAfter < alertThresholdPercent;
    const alertMessage = alert
      ? `Reserve funding dropped to ${percentFundedAfter.toFixed(1)}% after this expenditure, ` +
        `below the ${alertThresholdPercent}% healthy-funding threshold. A catch-up plan is ` +
        `typically recommended below this level.`
      : null;

    const tenYearOutlook = ReserveTrackerService.projectOutlook(
      reserveBalanceAfterExpenditure,
      assetsAfterExpenditure,
      {
        annualContribution: input.annualContribution,
        interestRatePercent,
        inflationRatePercent,
        projectionYears,
        alertThresholdPercent,
      }
    );

    return {
      fullyFundedBalanceBefore,
      percentFundedBefore,
      reserveBalanceAfterExpenditure,
      fullyFundedBalanceAfter,
      percentFundedAfter,
      alert,
      alertMessage,
      tenYearOutlook,
    };
  }
}
