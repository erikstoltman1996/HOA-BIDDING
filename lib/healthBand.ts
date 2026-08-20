// Shared green/gold/red health-band system, used anywhere a percent-funded
// or percent-collected figure needs color coding: the Money & Funding
// dashboard's stat tiles, the reserve fund outlook table, and the dues
// collection rate. One place so every page actually agrees on the bands.

export type HealthBand = "good" | "fair" | "risk";

const GOOD_THRESHOLD = 70;
const FAIR_THRESHOLD = 30;

export function healthBand(percent: number): HealthBand {
  if (percent >= GOOD_THRESHOLD) return "good";
  if (percent >= FAIR_THRESHOLD) return "fair";
  return "risk";
}

const HEALTH_BAND_COLOR: Record<HealthBand, string> = {
  good: "#3F6B4E", // check-green
  fair: "#B8863B", // gold
  risk: "#B91C1C", // danger
};

export function healthBandColor(percent: number): string {
  return HEALTH_BAND_COLOR[healthBand(percent)];
}
