/**
 * ReserveTrackerService — projects an HOA's reserve fund balance forward and
 * flags when it's underfunded.
 *
 * "Percent funded" follows the standard reserve-study definition: the ratio
 * of the actual reserve balance to the "fully funded balance" — the ideal
 * balance if every asset had been saved for evenly across its whole
 * lifespan (replacementCost × age/lifespan, summed across assets). 70% is
 * the commonly used threshold below which a reserve fund is considered at
 * risk; that's the default alert threshold here.
 *
 * One deliberate addition beyond the literal spec: `annualContribution` is
 * optional and defaults to 0. Without some notion of money flowing in, a
 * multi-year projection can only ever go down, which makes for a fairly
 * useless outlook — but the default keeps the "no new funding assumed"
 * case honest for callers who don't supply one.
 */

export interface CommunityAsset {
  id: string;
  name: string;
  /** Years between replacements once installed. Must be > 0. */
  expectedLifespanYears: number;
  /** Cost to replace, in today's dollars. Must be >= 0. */
  replacementCost: number;
  /** Years since the asset was last installed/replaced. Must be >= 0. */
  currentAgeYears: number;
}

export interface UnplannedExpenditure {
  description: string;
  /** Must be >= 0. */
  amount: number;
  /** Which projection year this lands in. 0 = this year. Defaults to 0. */
  yearIndex?: number;
  /**
   * If this expenditure is an early replacement of a tracked asset, its id.
   * Resets that asset's age to 0 in the projection from this year on.
   */
  assetId?: string;
}

export interface ReserveTrackerInputs {
  currentReserveBalance: number;
  assets: CommunityAsset[];
  newExpenditure: UnplannedExpenditure;
  /** Planned annual contribution to reserves. Defaults to 0. */
  annualContribution?: number;
  /** How many years to project, including year 0. Defaults to 10. */
  projectionYears?: number;
  /** percentFunded below this raises the alert flag. Defaults to 70. */
  alertThresholdPercent?: number;
}

export interface YearOutlook {
  /** 0-based offset from now — year 0 is the current year. */
  year: number;
  startingBalance: number;
  contributions: number;
  /** Sum of replacement costs for assets that came due this year (excludes the unplanned expenditure). */
  scheduledReplacementCost: number;
  /** The unplanned expenditure's amount, if it lands in this year — otherwise 0. */
  unplannedExpenditure: number;
  endingBalance: number;
  /** Ideal balance this year given each asset's age relative to its lifespan. */
  fullyFundedBalance: number;
  /** endingBalance / fullyFundedBalance × 100. 100 when fullyFundedBalance is 0 (no obligations). */
  percentFunded: number;
  assetsReplacedThisYear: string[];
}

export interface ReserveTrackerResult {
  outlook: YearOutlook[];
  /** True if percentFunded drops below the threshold in any projected year. */
  alert: boolean;
  /** The first year (0-based) where the threshold was breached, or null if never. */
  firstAlertYear: number | null;
  /** Percent funded right now, before any projection or the new expenditure. */
  currentPercentFunded: number;
}

const DEFAULT_PROJECTION_YEARS = 10;
const DEFAULT_ALERT_THRESHOLD_PERCENT = 70;

export class ReserveTrackerService {
  private readonly projectionYears: number;
  private readonly alertThresholdPercent: number;

  constructor(options?: { projectionYears?: number; alertThresholdPercent?: number }) {
    this.projectionYears = options?.projectionYears ?? DEFAULT_PROJECTION_YEARS;
    this.alertThresholdPercent = options?.alertThresholdPercent ?? DEFAULT_ALERT_THRESHOLD_PERCENT;
  }

  /** Computes the fully funded (ideal) balance for a set of assets at their given ages. */
  private static fullyFundedBalance(assets: CommunityAsset[], ages: number[]): number {
    return assets.reduce((sum, asset, i) => {
      const fraction = Math.min(1, Math.max(0, ages[i] / asset.expectedLifespanYears));
      return sum + asset.replacementCost * fraction;
    }, 0);
  }

  private static percentFunded(balance: number, fullyFunded: number): number {
    if (fullyFunded === 0) return 100;
    return (balance / fullyFunded) * 100;
  }

  private static validate(inputs: ReserveTrackerInputs) {
    if (!Number.isFinite(inputs.currentReserveBalance)) {
      throw new Error("currentReserveBalance must be a finite number");
    }
    for (const asset of inputs.assets) {
      if (!(asset.expectedLifespanYears > 0)) {
        throw new Error(`Asset "${asset.name}" must have expectedLifespanYears > 0`);
      }
      if (asset.replacementCost < 0) {
        throw new Error(`Asset "${asset.name}" must have replacementCost >= 0`);
      }
      if (asset.currentAgeYears < 0) {
        throw new Error(`Asset "${asset.name}" must have currentAgeYears >= 0`);
      }
    }
    if (inputs.newExpenditure.amount < 0) {
      throw new Error("newExpenditure.amount must be >= 0");
    }
    if (inputs.annualContribution !== undefined && inputs.annualContribution < 0) {
      throw new Error("annualContribution must be >= 0");
    }
    if (inputs.projectionYears !== undefined && inputs.projectionYears <= 0) {
      throw new Error("projectionYears must be > 0");
    }
  }

  /**
   * Projects the reserve balance forward, applying scheduled asset
   * replacements as they come due, the annual contribution (if any), and
   * the new unplanned expenditure in its designated year.
   */
  calculate(inputs: ReserveTrackerInputs): ReserveTrackerResult {
    ReserveTrackerService.validate(inputs);

    const {
      currentReserveBalance,
      assets,
      newExpenditure,
      annualContribution = 0,
    } = inputs;
    const projectionYears = inputs.projectionYears ?? this.projectionYears;
    const alertThresholdPercent = inputs.alertThresholdPercent ?? this.alertThresholdPercent;
    const expenditureYear = newExpenditure.yearIndex ?? 0;

    const initialAges = assets.map((a) => a.currentAgeYears);
    const currentPercentFunded = ReserveTrackerService.percentFunded(
      currentReserveBalance,
      ReserveTrackerService.fullyFundedBalance(assets, initialAges),
    );

    const ages = [...initialAges];
    let balance = currentReserveBalance;
    let firstAlertYear: number | null = null;
    const outlook: YearOutlook[] = [];

    for (let year = 0; year < projectionYears; year++) {
      const startingBalance = balance;
      balance += annualContribution;

      let scheduledReplacementCost = 0;
      const assetsReplacedThisYear: string[] = [];
      assets.forEach((asset, i) => {
        ages[i] += 1;
        if (ages[i] >= asset.expectedLifespanYears) {
          scheduledReplacementCost += asset.replacementCost;
          assetsReplacedThisYear.push(asset.name);
          ages[i] = 0;
        }
      });
      balance -= scheduledReplacementCost;

      const unplannedExpenditure = year === expenditureYear ? newExpenditure.amount : 0;
      if (unplannedExpenditure > 0) {
        balance -= unplannedExpenditure;
        if (newExpenditure.assetId) {
          const idx = assets.findIndex((a) => a.id === newExpenditure.assetId);
          if (idx >= 0) ages[idx] = 0;
        }
      }

      const endingBalance = balance;
      const fullyFundedBalance = ReserveTrackerService.fullyFundedBalance(assets, ages);
      const percentFunded = ReserveTrackerService.percentFunded(endingBalance, fullyFundedBalance);

      if (percentFunded < alertThresholdPercent && firstAlertYear === null) {
        firstAlertYear = year;
      }

      outlook.push({
        year,
        startingBalance,
        contributions: annualContribution,
        scheduledReplacementCost,
        unplannedExpenditure,
        endingBalance,
        fullyFundedBalance,
        percentFunded,
        assetsReplacedThisYear,
      });
    }

    return {
      outlook,
      alert: firstAlertYear !== null,
      firstAlertYear,
      currentPercentFunded,
    };
  }
}
