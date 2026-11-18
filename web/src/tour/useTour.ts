import { createContext, useContext } from "react";
import type { Mission } from "./missions";
import type { TourSnapshot } from "./snapshot";
import type { TourProgress } from "./storage";

export type MissionView = Mission & { done: boolean };

export type TourNotice = {
  id: number;
  tone: "success" | "info";
  message: string;
};

/** Project-scoped slice of the snapshot, pushed by the project bridge. */
export type ProjectReport = {
  projectId: string;
  snapshot: Partial<TourSnapshot>;
};

export type TourContextValue = {
  /** Null until the user is known and the stored progress was loaded. */
  progress: TourProgress | null;
  snapshot: TourSnapshot;
  missions: MissionView[];
  nextMission: Mission | null;
  percent: number;
  activeMissionId: string | null;
  /** True once the first evaluation can run (user + projects loaded). */
  showWelcome: boolean;
  notices: TourNotice[];
  startMission: (missionId: string) => void;
  completeWelcome: () => void;
  dismiss: () => void;
  reopen: () => void;
  /** Resets progress; existing work is re-detected silently. */
  restart: () => void;
  dismissNotice: (id: number) => void;
  reportProject: (report: ProjectReport | null) => void;
};

export const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const context = useContext(TourContext);
  if (!context) throw new Error("useTour must be used inside TourProvider");
  return context;
}
