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
import { useProjects } from "../features/projects/hooks/useProjects";
import { MISSIONS, missionProgress, nextMission } from "./missions";
import { reconcileProgress } from "./progress";
import {
  EMPTY_TOUR_SNAPSHOT,
  mergeSnapshot,
  sameSnapshot,
  type TourSnapshot,
} from "./snapshot";
import { stepsForMission } from "./steps";
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
  type TourNotice,
} from "./useTour";

const MAX_NOTICES = 3;

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
 * is a silent baseline, later completions become notices.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { projects, loading: projectsLoading, error } = useProjects();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const routeProjectId =
    useMatch("/projects/:projectId/*")?.params.projectId ?? null;
  const userId = user?.id ?? null;

  const [store, setStore] = useState<Store | null>(null);
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [notices, setNotices] = useState<TourNotice[]>([]);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);

  const persistedRef = useRef<TourProgress | null>(null);
  const baselineDone = useRef(false);
  const seenProjects = useRef(new Set<string>());
  const lastEval = useRef<{ progress: TourProgress; snapshot: TourSnapshot }>();
  const noticeId = useRef(0);
  const disposeTour = useRef<(() => void) | null>(null);
  const tourRoute = useRef<string | null>(null);

  const progress = store && store.userId === userId ? store.progress : null;

  // Load stored progress only after the user is known.
  useEffect(() => {
    baselineDone.current = false;
    seenProjects.current.clear();
    lastEval.current = undefined;
    if (!userId) {
      setStore(null);
      return;
    }
    const loaded = loadProgress(userId);
    persistedRef.current = loaded;
    setStore({ userId, progress: loaded });
  }, [userId]);

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

  const reportProject = useCallback(
    (next: ProjectReport | null) =>
      setReport((current) => (sameReport(current, next) ? current : next)),
    [],
  );

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

  const pushNotices = useCallback((items: Omit<TourNotice, "id">[]) => {
    setNotices((current) =>
      [
        ...current,
        ...items.map((item) => ({ ...item, id: ++noticeId.current })),
      ].slice(-MAX_NOTICES),
    );
  }, []);

  useEffect(() => {
    if (!ready || !progress) return;
    const last = lastEval.current;
    if (last && last.progress === progress && last.snapshot === snapshot) {
      return;
    }
    lastEval.current = { progress, snapshot };
    const baseline =
      !baselineDone.current ||
      (routeProjectId !== null && !seenProjects.current.has(routeProjectId));
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
    const toasts = result.newlyCompleted.flatMap((id) => {
      const mission = MISSIONS.find((item) => item.id === id);
      return mission
        ? [{ tone: "success" as const, message: mission.doneToast }]
        : [];
    });
    const next = nextMission(result.progress.completed);
    pushNotices([
      ...toasts,
      ...(next
        ? [{ tone: "info" as const, message: `Siguiente paso: ${next.title}.` }]
        : []),
    ]);
  }, [ready, progress, snapshot, routeProjectId, updateProgress, pushNotices]);

  const stopTour = useCallback(() => {
    disposeTour.current?.();
    disposeTour.current = null;
    tourRoute.current = null;
    setActiveMissionId(null);
  }, []);

  // One tour at a time: leaving the tour's page or unmounting ends it.
  useEffect(() => {
    if (tourRoute.current && tourRoute.current !== pathname) stopTour();
  }, [pathname, stopTour]);
  useEffect(() => stopTour, [stopTour]);

  const latestProjectId = useMemo(() => {
    const sorted = [...projects].sort((a, b) =>
      (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt),
    );
    return sorted[0]?.id ?? null;
  }, [projects]);

  const startMission = useCallback(
    (missionId: string) => {
      const mission = MISSIONS.find((item) => item.id === missionId);
      if (!mission) return;
      const projectId = routeProjectId ?? latestProjectId ?? undefined;
      let targetId = mission.id;
      let route = mission.route(projectId);
      if (route === null) {
        // Project missions need a project first: point the user to create one.
        targetId = "create-project";
        route = "/projects";
        pushNotices([
          { tone: "info", message: "Primero crea un proyecto para continuar." },
        ]);
      }
      stopTour();
      if (route !== pathname) navigate(route);
      tourRoute.current = route;
      setActiveMissionId(targetId);
      disposeTour.current = runMicroTour(stepsForMission(targetId), {
        onDestroy: () => {
          disposeTour.current = null;
          tourRoute.current = null;
          setActiveMissionId(null);
        },
      });
    },
    [
      routeProjectId,
      latestProjectId,
      pathname,
      navigate,
      stopTour,
      pushNotices,
    ],
  );

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
    setNotices([]);
    setStore({ userId, progress: fresh });
  }, [userId, stopTour]);
  const dismissNotice = useCallback(
    (id: number) =>
      setNotices((current) => current.filter((notice) => notice.id !== id)),
    [],
  );

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
      notices,
      startMission,
      completeWelcome,
      dismiss,
      reopen,
      restart,
      dismissNotice,
      reportProject,
    };
  }, [
    progress,
    snapshot,
    activeMissionId,
    ready,
    notices,
    startMission,
    completeWelcome,
    dismiss,
    reopen,
    restart,
    dismissNotice,
    reportProject,
  ]);

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
