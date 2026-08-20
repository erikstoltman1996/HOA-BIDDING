import type { Database } from "@/types/database";

export type ProjectStatus = Database["public"]["Tables"]["projects"]["Row"]["status"];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  bidding: "Bidding",
  awarded: "Awarded",
  in_progress: "In progress",
  complete: "Complete",
};

// Small, precise status dots — Linear's restraint, not a loud colored
// badge. Reuses the existing palette: gray for "not started yet," gold for
// "underway" (both awarded and in_progress read as active work to a board
// member glancing at a card), green for done. Shared by the Home
// dashboard's current-project card and the /projects list so they can't
// drift apart.
export const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  bidding: "#5B6578", // ink-soft
  awarded: "#B8863B", // gold
  in_progress: "#B8863B", // gold
  complete: "#3F6B4E", // check-green
};
