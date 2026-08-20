/**
 * Monthly-resolution version of ReserveTrackerService.projectOutlook().
 *
 * Deliberately kept OUT of ReserveTrackerService.ts — that file was
 * supplied as tested, working calculation logic with explicit instructions
 * not to rewrite it. This reuses its public static methods
 * (applyExpenditure, calculateFullyFundedBalance, calculatePercentFunded)
 * rather than duplicating their formulas, so "same underlying math, just
 * finer-grained" is literally true: the two files can never silently
 * diverge on what Fully Funded Balance or Percent Funded mean.
 *
 * What's actually different at month resolution:
 *   - Monthly contribution = annual contribution / 12.
 *   - Monthly interest rate is the true equivalent compounding rate,
 *     (1 + annualRate)^(1/12) - 1 — not annualRate / 12 (that would
 *     under-compound relative to the stated annual rate).
 *   - Each asset's remaining life is tracked in months and only replaced
 *     the month it actually hits zero, not smeared evenly across a year.
 */

import {
  ReserveTrackerService,
  type CommunityAsset,
  type UnplannedExpenditure,
} from "./ReserveTrackerService";

export interface MonthProjection {
  /** 1-indexed month of the projection (month 1 = one month from now). */
  month: number;
  startingBalance: number;
  contribution: number;
  interestEarned: number;
  /** Total cost of components reaching end-of-life this month. */
  plannedExpenditures: number;
  endingBalance: number;
  fullyFundedBalance: number;
  percentFunded: number;
  belowThreshold: boolean;
  /** Names of assets replaced this month, if any. */
  assetsReplaced: string[];
}

export interface MonthlyProjectionOptions {
  annualContribution: number;
  interestRatePercent: number;
  inflationRatePercent: number;
  /** Same horizon the yearly outlook uses, expressed in years — converted
   *  to months (* 12) internally so both views cover the same span. */
  projectionYears: number;
  alertThresholdPercent: number;
}

interface WorkingAsset {
  name: string;
  replacementCost: number;
  usefulLifeMonths: number;
  remainingMonths: number;
}

export function projectOutlookMonthly(
  currentReserveBalance: number,
  assets: CommunityAsset[],
  unplannedExpenditure: UnplannedExpenditure | undefined,
  options: MonthlyProjectionOptions,
): MonthProjection[] {
  const { balance: startBalance, assets: startAssets } = ReserveTrackerService.applyExpenditure(
    currentReserveBalance,
    assets,
    unplannedExpenditure,
  );

  const monthlyContribution = options.annualContribution / 12;
  const annualRate = options.interestRatePercent / 100;
  // Equivalent monthly compounding rate — compounding this 12 times gets
  // back to (1 + annualRate), rather than under-compounding at rate/12.
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  const inflationRate = options.inflationRatePercent / 100;
  const totalMonths = options.projectionYears * 12;

  let balance = startBalance;
  let working: WorkingAsset[] = startAssets.map((a) => ({
    name: a.name,
    replacementCost: a.replacementCost,
    usefulLifeMonths: Math.round(a.usefulLifeYears * 12),
    remainingMonths: Math.round(a.remainingUsefulLifeYears * 12),
  }));

  const outlook: MonthProjection[] = [];

  for (let month = 1; month <= totalMonths; month++) {
    const startingMonthBalance = balance;
    const inflationFactor = Math.pow(1 + inflationRate, month / 12);

    let plannedExpenditures = 0;
    const assetsReplaced: string[] = [];

    working = working.map((asset) => {
      const aged = asset.remainingMonths - 1;
      if (aged <= 0) {
        plannedExpenditures += asset.replacementCost * inflationFactor;
        assetsReplaced.push(asset.name);
        return { ...asset, remainingMonths: asset.usefulLifeMonths };
      }
      return { ...asset, remainingMonths: aged };
    });

    const interestEarned = startingMonthBalance * monthlyRate;
    balance = startingMonthBalance + monthlyContribution + interestEarned - plannedExpenditures;

    const fullyFundedBalance = ReserveTrackerService.calculateFullyFundedBalance(
      working.map((w) => ({
        id: w.name,
        name: w.name,
        replacementCost: w.replacementCost,
        usefulLifeYears: w.usefulLifeMonths / 12,
        remainingUsefulLifeYears: w.remainingMonths / 12,
      })),
    );
    const percentFunded = ReserveTrackerService.calculatePercentFunded(balance, fullyFundedBalance);

    outlook.push({
      month,
      startingBalance: startingMonthBalance,
      contribution: monthlyContribution,
      interestEarned,
      plannedExpenditures,
      endingBalance: balance,
      fullyFundedBalance,
      percentFunded,
      belowThreshold: percentFunded < options.alertThresholdPercent,
      assetsReplaced,
    });
  }

  return outlook;
}
