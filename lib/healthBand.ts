// Shared green/gold/red health-band system, used anywhere a percent-funded
// or percent-collected figure needs color coding: the Money & Funding
// dashboard's stat tiles, the reserve fund outlook table, and the dues
// collection rate. One color scale, parameterized per metric — different
// metrics have very different "healthy" bars (70% funded is fine for a
// reserve fund; 70% dues collected would be a crisis), so thresholds are
// passed in rather than hardcoded, keeping every caller on the same
// green/gold/red visual language without sharing one number that doesn't
// fit all of them.

export type HealthBand = "good" | "fair" | "risk";

export interface HealthBandThresholds {
  /** percent >= this is "good" (green) */
  good: number;
  /** percent >= this (and below `good`) is "fair" (gold); below it is "risk" (red) */
  fair: number;
}

// Reserve fund percent-funded: 70%+ is the commonly cited healthy bar for
// HOA reserve studies, 30-70% is underfunded but recoverable, below 30% is
// a real risk of special assessments.
export const RESERVE_FUND_THRESHOLDS: HealthBandThresholds = { good: 70, fair: 30 };

// Dues collection rate: unlike reserve funding, near-full collection is the
// normal expectation for a healthy HOA, not an aspirational ceiling — a
// board collecting only 70% of dues has a serious delinquency problem, not
// a "fair" one.
export const DUES_COLLECTION_THRESHOLDS: HealthBandThresholds = { good: 95, fair: 85 };

export function healthBand(
  percent: number,
  thresholds: HealthBandThresholds = RESERVE_FUND_THRESHOLDS,
): HealthBand {
  if (percent >= thresholds.good) return "good";
  if (percent >= thresholds.fair) return "fair";
  return "risk";
}

const HEALTH_BAND_COLOR: Record<HealthBand, string> = {
  good: "#3F6B4E", // check-green
  // Gold darkened for text use — raw gold (#B8863B) measures 2.93:1 on
  // paper-card, failing WCAG AA even at large-text size (needs 3:1; normal
  // text needs 4.5:1). This value hits 5.2:1. See --color-gold-text in
  // globals.css — border/background uses of gold elsewhere are unaffected.
  fair: "#83602A",
  risk: "#B91C1C", // danger
};

export function healthBandColor(
  percent: number,
  thresholds: HealthBandThresholds = RESERVE_FUND_THRESHOLDS,
): string {
  return HEALTH_BAND_COLOR[healthBand(percent, thresholds)];
}
