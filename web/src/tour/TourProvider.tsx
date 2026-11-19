import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";
import { useToast } from "../components/ui/Toast";
import { useProjects } from "../features/projects/hooks/useProjects";
import { MISSIONS, missionProgress, nextMission } from "./missions";
import { reconcileProgress, type BaselineScope } from "./progress";
import {
  EMPTY_TOUR_SNAPSHOT,
  mergeSnapshot,
  sameSnapshot,
  type TourSnapshot,
} from "./snapshot";
import {
  MISSION_UNAVAILABLE_HINTS,
  TOUR_UNAVAILABLE_MESSAGE,
  stepsForMission,
} from "./steps";
import {
  DEFAULT_TOUR_PROGRESS,
  loadProgress,
  resetProgress,
  saveProgress,
  type TourProgress,
} from "./storage";
import { runMicroTour } from "./tourRunner";
import {
  TourContext,
  type MissionView,
  type ProjectReport,
  type TourContextValue,
} from "./useTour";

const PROJECT_ROUTE_WAIT_MS = 5000;
const NEXT_STEP_TOAST_MS = 12000;

type Store = { userId: string; progress: TourProgress };

function freshProgress(): TourProgress {
  return { ...DEFAULT_TOUR_PROGRESS, completed: [] };
}

function sameReport(a: ProjectReport | null, b: ProjectReport | null) {
  if (a === b) return true;
  if (!a || !b || a.projectId !== b.projectId) return false;
  return sameSnapshot(
    mergeSnapshot(EMPTY_TOUR_SNAPSHOT, a.snapshot),
    mergeSnapshot(EMPTY_TOUR_SNAPSHOT, b.snapshot),
  );
}

/**
 * Observes what the user does (project list + project bridge) and keeps the
 * mission progress. It never forces a script: the first evaluation after load
 * is a silent baseline, later completions become toasts.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const {
    projects,
    loading: projectsLoading,
    error,
    refresh: refreshProjects,
  } = useProjects();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const routeProjectId =
    useMatch("/projects/:projectId/*")?.params.projectId ?? null;
  const userId = user?.id ?? null;

  const [store, setStore] = useState<Store | null>(null);
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);

  const persistedRef = useRef<TourProgress | null>(null);
  const baselineDone = useRef(false);
  const seenProjects = useRef(new Set<string>());
  const lastEval = useRef<{ progress: TourProgress; snapshot: TourSnapshot }>();
  // Ids of the tour toasts on screen; replaced (not stacked) by the next ones.
  const tourToasts = useRef<string[]>([]);
  const { toast, dismiss: dismissToast } = useToast();
  const startMissionRef = useRef<(missionId: string) => void>(() => {});
  const disposeTour = useRef<(() => void) | null>(null);
  const tourRoute = useRef<string | null>(null);
  // Last project the bridge reported: the project list in this provider is
  // fetched once, so it can miss a project created later.
  const lastProjectId = useRef<string | null>(null);

  const progress = store && store.userId === userId ? store.progress : null;

  const stopTour = useCallback(() => {
    disposeTour.current?.();
    disposeTour.current = null;
    tourRoute.current = null;
    setActiveMissionId(null);
  }, []);

  const clearTourToasts = useCallback(() => {
    tourToasts.current.forEach(dismissToast);
    tourToasts.current = [];
  }, [dismissToast]);

  // Toasts live in the outer provider, so they must be dismissed when the tour
  // provider unmounts (e.g. logout); otherwise "Mostrarme" would call into a
  // dead provider.
  const clearTourToastsRef = useRef(clearTourToasts);
  clearTourToastsRef.current = clearTourToasts;
  useEffect(() => () => clearTourToastsRef.current(), []);

  // Replaces the previous tour toasts so completions never pile up.
  const showTourToasts = useCallback(
    (items: Parameters<typeof toast.custom>[0][]) => {
      clearTourToasts();
      tourToasts.current = items.map((item) => toast.custom(item));
    },
    [toast, clearTourToasts],
  );

  // Load stored progress only after the user is known; a user change also
  // drops everything that belonged to the previous user.
  useEffect(() => {
    baselineDone.current = false;
    seenProjects.current.clear();
    lastEval.current = undefined;
    lastProjectId.current = null;
    stopTour();
    clearTourToasts();
    setReport(null);
    if (!userId) {
      setStore(null);
      return;
    }
    const loaded = loadProgress(userId);
    persistedRef.current = loaded;
    setStore({ userId, progress: loaded });
  }, [userId, stopTour, clearTourToasts]);

  useEffect(() => {
    if (!userId || !progress || persistedRef.current === progress) return;
    persistedRef.current = progress;
    saveProgress(userId, progress);
  }, [userId, progress]);

  const updateProgress = useCallback(
    (update: (current: TourProgress) => TourProgress) =>
      setStore((current) =>
        current ? { ...current, progress: update(current.progress) } : current,
      ),
    [],
  );

  const reportProject = useCallback((next: ProjectReport | null) => {
    if (next?.projectId) lastProjectId.current = next.projectId;
    setReport((current) => (sameReport(current, next) ? current : next));
  }, []);

  // Global part from the list; project part from the bridge (same project only).
  const projectPart =
    report && report.projectId === routeProjectId ? report.snapshot : null;
  const snapshot = useMemo<TourSnapshot>(
    () =>
      mergeSnapshot(EMPTY_TOUR_SNAPSHOT, {
        ...projectPart,
        projectCount: Math.max(projects.length, routeProjectId ? 1 : 0),
      }),
    [projectPart, projects.length, routeProjectId],
  );

  const ready =
    Boolean(userId) &&
    progress !== null &&
    !projectsLoading &&
    !error &&
    (!routeProjectId || projectPart !== null);

  useEffect(() => {
    if (!ready || !progress) return;
    const last = lastEval.current;
    if (last && last.progress === progress && last.snapshot === snapshot) {
      return;
    }
    lastEval.current = { progress, snapshot };
    // First evaluation: everything pre-existing is silent. A first visit to a
    // project only silences its own work; a global completion (a project
    // created after the baseline) still gets its toast.
    const baseline: BaselineScope = !baselineDone.current
      ? "all"
      : routeProjectId !== null && !seenProjects.current.has(routeProjectId)
        ? "project"
        : "none";
    baselineDone.current = true;
    if (routeProjectId) seenProjects.current.add(routeProjectId);

    const result = reconcileProgress(progress, snapshot, { baseline });
    if (result.progress !== progress) {
      updateProgress((current) => ({
        ...current,
        completed: [
          ...current.completed,
          ...result.progress.completed.filter(
            (id) => !current.completed.includes(id),
          ),
        ],
      }));
    }
    if (result.newlyCompleted.length === 0 || progress.dismissed) return;
    const done = result.newlyCompleted.flatMap((id) => {
      const mission = MISSIONS.find((item) => item.id === id);
      return mission ? [mission.doneToast] : [];
    });
    const next = nextMission(result.progress.completed);
    showTourToasts([
      ...(done.length
        ? [
            {
              type: "success" as const,
              title: "Paso completado",
              message: done.join(" "),
            },
          ]
        : []),
      ...(next
        ? [
            {
              type: "info" as const,
              title: `Siguiente paso: ${next.title}`,
              message: next.nextHint,
              durationMs: NEXT_STEP_TOAST_MS,
              action: {
                label: "Mostrarme",
                onClick: () => startMissionRef.current(next.id),
              },
            },
          ]
        : []),
    ]);
  }, [
    ready,
    progress,
    snapshot,
    routeProjectId,
    updateProgress,
    showTourToasts,
  ]);

  // One tour at a time: leaving the tour's page or unmounting ends it.
  useEffect(() => {
    if (tourRoute.current && tourRoute.current !== pathname) stopTour();
  }, [pathname, stopTour]);
  useEffect(() => stopTour, [stopTour]);

  const latestOf = useCallback(
    (list: readonly { id: string; createdAt: string; updatedAt?: string }[]) =>
      [...list].sort((a, b) =>
        (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt),
      )[0]?.id ?? null,
    [],
  );

  const startMission = useCallback(
    (missionId: string) => {
      const mission = MISSIONS.find((item) => item.id === missionId);
      if (!mission) return;
      const launch = (projectId: string | null) => {
        let targetId = mission.id;
        let route = mission.route(projectId ?? undefined);
        if (route === null) {
          // Project missions need a project first: point the user to create one.
          targetId = "create-project";
          route = "/projects";
          showTourToasts([
            {
              type: "info",
              title: "Falta un proyecto",
              message: "Primero crea un proyecto para continuar.",
            },
          ]);
        }
        stopTour();
        if (route !== pathname) navigate(route);
        tourRoute.current = route;
        setActiveMissionId(targetId);
        const hint = MISSION_UNAVAILABLE_HINTS[targetId];
        disposeTour.current = runMicroTour(stepsForMission(targetId), {
          waitMs: route.startsWith("/projects/")
            ? PROJECT_ROUTE_WAIT_MS
            : undefined,
          onUnavailable: () =>
            showTourToasts([
              {
                type: "warning",
                title: "No se pudo mostrar el paso",
                message: hint
                  ? `${TOUR_UNAVAILABLE_MESSAGE} ${hint}`
                  : TOUR_UNAVAILABLE_MESSAGE,
              },
            ]),
          onDestroy: () => {
            disposeTour.current = null;
            tourRoute.current = null;
            setActiveMissionId(null);
          },
        });
      };
      const known =
        routeProjectId ?? lastProjectId.current ?? latestOf(projects);
      if (known || mission.route(undefined) !== null) {
        launch(known);
        return;
      }
      // The list may be stale (project created after it was fetched):
      // refresh once before telling the user to create one.
      Promise.resolve()
        .then(refreshProjects)
        .then((fresh) => (fresh ? latestOf(fresh) : null))
        .catch(() => null)
        .then(launch);
    },
    [
      routeProjectId,
      projects,
      latestOf,
      refreshProjects,
      pathname,
      navigate,
      stopTour,
      showTourToasts,
    ],
  );
  useEffect(() => {
    startMissionRef.current = startMission;
  }, [startMission]);

  const completeWelcome = useCallback(
    () => updateProgress((current) => ({ ...current, welcomed: true })),
    [updateProgress],
  );
  const dismiss = useCallback(() => {
    stopTour();
    updateProgress((current) => ({
      ...current,
      welcomed: true,
      dismissed: true,
    }));
  }, [stopTour, updateProgress]);
  const reopen = useCallback(
    () => updateProgress((current) => ({ ...current, dismissed: false })),
    [updateProgress],
  );
  const restart = useCallback(() => {
    if (!userId) return;
    stopTour();
    const fresh = freshProgress();
    persistedRef.current = fresh;
    resetProgress(userId);
    baselineDone.current = false;
    seenProjects.current.clear();
    lastEval.current = undefined;
    clearTourToasts();
    setStore({ userId, progress: fresh });
  }, [userId, stopTour, clearTourToasts]);

  const value = useMemo<TourContextValue>(() => {
    const completed = progress?.completed ?? [];
    const missions: MissionView[] = MISSIONS.map((mission) => ({
      ...mission,
      done: completed.includes(mission.id),
    }));
    const { done, total } = missionProgress(completed);
    return {
      progress,
      snapshot,
      missions,
      nextMission: nextMission(completed),
      percent: total ? Math.round((done / total) * 100) : 0,
      activeMissionId,
      showWelcome: ready && !progress?.welcomed && !progress?.dismissed,
      startMission,
      completeWelcome,
      dismiss,
      reopen,
      restart,
      reportProject,
    };
  }, [
    progress,
    snapshot,
    activeMissionId,
    ready,
    startMission,
    completeWelcome,
    dismiss,
    reopen,
    restart,
    reportProject,
  ]);

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
