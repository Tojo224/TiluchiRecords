import { useEffect, useMemo, useRef } from "react";
import { useProject } from "../features/projects/context/ProjectContext";
import {
  EMPTY_TOUR_SNAPSHOT,
  mergeSnapshot,
  sameSnapshot,
  snapshotFromProject,
  type TourSnapshot,
} from "./snapshot";
import { useTour } from "./useTour";

/**
 * Renders nothing. Lives inside the project layout (where `useProject` is
 * available) and reports the primitives-only project snapshot to the tour
 * provider, only when it actually changed (the project is polled every 1-3 s).
 */
export function TourProjectBridge() {
  const { project } = useProject();
  const { reportProject } = useTour();
  const projectId = project.id;
  const snapshot = useMemo(
    () => mergeSnapshot(EMPTY_TOUR_SNAPSHOT, snapshotFromProject(project)),
    [project],
  );
  const lastReported = useRef<{ id: string; snapshot: TourSnapshot } | null>(
    null,
  );

  useEffect(() => {
    const last = lastReported.current;
    if (last && last.id === projectId && sameSnapshot(last.snapshot, snapshot))
      return;
    lastReported.current = { id: projectId, snapshot };
    reportProject({ projectId, snapshot });
  }, [projectId, snapshot, reportProject]);

  useEffect(
    () => () => {
      lastReported.current = null;
      reportProject(null);
    },
    [reportProject],
  );

  return null;
}
