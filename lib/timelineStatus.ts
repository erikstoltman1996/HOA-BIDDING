import type { Database } from "@/types/database";

export type TimelineStatus = Database["public"]["Tables"]["weekly_updates"]["Row"]["timeline_status"];

export const TIMELINE_STATUS_LABEL: Record<TimelineStatus, string> = {
  on_track: "On track",
  ahead: "Ahead of schedule",
  delayed: "Delayed",
};

// Same Linear-style small-dot treatment as PROJECT_STATUS_COLOR in
// lib/projectStatus.ts, applied here for consistency — every status
// indicator in the app should read the same way. Shared between the Home
// dashboard's Latest Update card and ContractorPanel's per-update timeline
// so they can't drift apart.
export const TIMELINE_STATUS_COLOR: Record<TimelineStatus, string> = {
  on_track: "#3F6B4E", // check-green
  ahead: "#3F6B4E", // check-green
  // Gold darkened for text — see --color-gold-text in globals.css.
  delayed: "#83602A",
};
