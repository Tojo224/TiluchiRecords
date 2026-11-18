import type { TourSnapshot } from "./snapshot";

export type Mission = {
  id: string;
  title: string;
  why: string;
  doneToast: string;
  /** Route where the mission happens; null when it needs a project first. */
  route: (projectId?: string) => string | null;
  optional?: boolean;
  detect: (snapshot: TourSnapshot) => boolean;
};

const projectRoute =
  (suffix: string) =>
  (projectId?: string): string | null =>
    projectId ? `/projects/${projectId}${suffix}` : null;

export const MISSIONS: readonly Mission[] = [
  {
    id: "create-project",
    title: "Crea tu primer proyecto",
    why: "Un proyecto guarda todos tus archivos y resultados en un solo lugar.",
    doneToast: "Listo, ya tienes un proyecto.",
    route: () => "/projects",
    detect: (s) => s.projectCount > 0,
  },
  {
    id: "upload-video",
    title: "Sube un video",
    why: "Es el material base para crear tu karaoke.",
    doneToast: "Video subido.",
    route: projectRoute("/karaoke"),
    detect: (s) => s.videoCount > 0,
  },
  {
    id: "create-karaoke",
    title: "Crea tu karaoke",
    why: "Separamos la voz y generamos la letra sincronizada.",
    doneToast: "Karaoke listo.",
    route: projectRoute("/karaoke"),
    detect: (s) => s.karaokeReady,
  },
  {
    id: "sing-karaoke",
    title: "Canta tu karaoke",
    why: "Graba tu interpretacion con la musica de fondo.",
    doneToast: "Interpretacion guardada.",
    route: projectRoute("/karaoke"),
    detect: (s) => s.performanceCount > 0,
  },
  {
    id: "upload-music",
    title: "Sube tu musica",
    why: "La pieza musical es la base de tu videoclip.",
    doneToast: "Musica subida.",
    route: projectRoute("/music-video"),
    detect: (s) => s.audioCount > 0,
  },
  {
    id: "create-plan",
    title: "Crea el plan de escenas",
    why: "Analizamos la musica y proponemos las escenas para que las revises.",
    doneToast: "Plan de escenas listo.",
    route: projectRoute("/music-video"),
    detect: (s) => s.storyboardReady,
  },
  {
    id: "generate-videoclip",
    title: "Genera tu videoclip",
    why: "Con el plan aprobado producimos los clips y los unimos.",
    doneToast: "Videoclip generado.",
    route: projectRoute("/music-video"),
    detect: (s) => s.finalVideoReady,
  },
  {
    id: "face-swap",
    title: "Prueba el reemplazo facial",
    why: "Cambia un rostro en un video con una imagen tuya.",
    doneToast: "Reemplazo facial listo.",
    route: projectRoute("/face-swap"),
    optional: true,
    detect: (s) => s.faceSwapResultCount > 0,
  },
];

export function completedMissionIds(snapshot: TourSnapshot): string[] {
  return MISSIONS.filter((mission) => mission.detect(snapshot)).map(
    (mission) => mission.id,
  );
}

/** First core mission not yet completed, or the optional one, else null. */
export function nextMission(completedIds: readonly string[]): Mission | null {
  return (
    MISSIONS.find(
      (mission) => !mission.optional && !completedIds.includes(mission.id),
    ) ??
    MISSIONS.find(
      (mission) => mission.optional && !completedIds.includes(mission.id),
    ) ??
    null
  );
}

/** Progress over core (non-optional) missions only. */
export function missionProgress(completedIds: readonly string[]): {
  done: number;
  total: number;
} {
  const core = MISSIONS.filter((mission) => !mission.optional);
  return {
    done: core.filter((mission) => completedIds.includes(mission.id)).length,
    total: core.length,
  };
}
