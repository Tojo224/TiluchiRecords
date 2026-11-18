import { completedMissionIds } from "./missions";
import type { TourSnapshot } from "./snapshot";
import type { TourProgress } from "./storage";

export type ReconcileResult = {
  progress: TourProgress;
  /** Mission ids completed by this evaluation (empty when silenced). */
  newlyCompleted: string[];
};

/**
 * What the evaluation records silently (pre-existing work, no toasts):
 * - "all": first evaluation after load (global and project part).
 * - "project": first visit to a project; only missions derived from the
 *   project part of the snapshot are silenced.
 * - "none": every new completion is reported.
 */
export type BaselineScope = "all" | "project" | "none";

/** Missions derived from the global snapshot (project list), not a project. */
export const GLOBAL_MISSION_IDS: readonly string[] = ["create-project"];

function isSilenced(id: string, baseline: BaselineScope): boolean {
  if (baseline === "all") return true;
  return baseline === "project" && !GLOBAL_MISSION_IDS.includes(id);
}

/**
 * Merges what the snapshot proves done into the stored progress.
 * - Never un-completes a mission.
 * - Idempotent: the same snapshot yields the same progress and no news.
 * - Missions silenced by `baseline` are recorded without being reported, so
 *   returning users do not get a burst of toasts.
 * Returns the SAME progress object when nothing changed.
 */
export function reconcileProgress(
  progress: TourProgress,
  snapshot: TourSnapshot,
  { baseline }: { baseline: BaselineScope },
): ReconcileResult {
  const added = completedMissionIds(snapshot).filter(
    (id) => !progress.completed.includes(id),
  );
  if (added.length === 0) return { progress, newlyCompleted: [] };
  return {
    progress: { ...progress, completed: [...progress.completed, ...added] },
    newlyCompleted: added.filter((id) => !isSilenced(id, baseline)),
  };
}
