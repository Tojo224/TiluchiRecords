import { completedMissionIds } from "./missions";
import type { TourSnapshot } from "./snapshot";
import type { TourProgress } from "./storage";

export type ReconcileResult = {
  progress: TourProgress;
  /** Mission ids completed by this evaluation (empty on baseline). */
  newlyCompleted: string[];
};

/**
 * Merges what the snapshot proves done into the stored progress.
 * - Never un-completes a mission.
 * - Idempotent: the same snapshot yields the same progress and no news.
 * - `baseline: true` (first evaluation after load) records existing work
 *   silently so returning users do not get a burst of toasts.
 * Returns the SAME progress object when nothing changed.
 */
export function reconcileProgress(
  progress: TourProgress,
  snapshot: TourSnapshot,
  { baseline }: { baseline: boolean },
): ReconcileResult {
  const added = completedMissionIds(snapshot).filter(
    (id) => !progress.completed.includes(id),
  );
  if (added.length === 0) return { progress, newlyCompleted: [] };
  return {
    progress: { ...progress, completed: [...progress.completed, ...added] },
    newlyCompleted: baseline ? [] : added,
  };
}
