import { TOUR_ANCHORS, type TourAnchorName } from "./anchors";

export type TourStepSide = "top" | "right" | "bottom" | "left";

/** One highlighted element inside a micro-tour. Pure data. */
export type TourStep = {
  target: TourAnchorName;
  title: string;
  description: string;
  side: TourStepSide;
  /** The user can click or type inside the highlighted element. */
  interactive: boolean;
};

/**
 * Micro-tour steps per mission id. Copy explains WHY, in plain Spanish
 * (ASCII only, project convention). Nothing here targets the singing modal:
 * the sing step points at the button that opens it.
 */
export const MISSION_STEPS: Readonly<Record<string, readonly TourStep[]>> = {
  "create-project": [
    {
      target: TOUR_ANCHORS.newProject,
      title: "Crea un proyecto",
      description:
        "Un proyecto reune tus videos, tu musica y los resultados en un solo lugar. Pulsa este boton para crear el primero.",
      side: "bottom",
      interactive: true,
    },
  ],
  "upload-video": [
    {
      target: TOUR_ANCHORS.karaokeUpload,
      title: "Sube un video",
      description:
        "Para el karaoke necesitas un video con musica y con la letra cantada. De ahi sacamos la voz y la pista.",
      side: "bottom",
      interactive: true,
    },
  ],
  "create-karaoke": [
    {
      target: TOUR_ANCHORS.karaokeCreate,
      title: "Crea tu karaoke",
      description:
        "Separamos la voz de la musica y sincronizamos la letra. Puede tardar unos minutos; puedes seguir usando la app mientras tanto.",
      side: "top",
      interactive: true,
    },
  ],
  "sing-karaoke": [
    {
      target: TOUR_ANCHORS.karaokeSing,
      title: "Canta tu karaoke",
      description:
        "Se abre una ventana para grabarte con la musica de fondo. Tu interpretacion queda guardada en el proyecto.",
      side: "top",
      interactive: true,
    },
  ],
  "upload-music": [
    {
      target: TOUR_ANCHORS.musicUpload,
      title: "Sube tu musica",
      description:
        "La pieza musical es la base del videoclip: con ella armamos las escenas.",
      side: "bottom",
      interactive: true,
    },
  ],
  "create-plan": [
    {
      target: TOUR_ANCHORS.musicPrompt,
      title: "Cuentanos la idea",
      description:
        "Describe el estilo o la historia que imaginas. Es opcional, pero ayuda a que las escenas se parezcan a lo que quieres.",
      side: "top",
      interactive: true,
    },
    {
      target: TOUR_ANCHORS.musicPlan,
      title: "Analiza y crea el plan",
      description:
        "Analizamos la musica y proponemos las escenas para que las revises antes de gastar tiempo en producir.",
      side: "top",
      interactive: true,
    },
  ],
  "generate-videoclip": [
    {
      target: TOUR_ANCHORS.musicProduce,
      title: "Genera tu videoclip",
      description:
        "Con el plan aprobado producimos cada clip y los unimos. Es la fase mas larga, asi que te avisaremos cuando termine.",
      side: "top",
      interactive: true,
    },
  ],
  "face-swap": [
    {
      target: TOUR_ANCHORS.faceSwapConsent,
      title: "Confirma el permiso",
      description:
        "Solo puedes reemplazar rostros con imagenes que tengas derecho a usar. Marca la confirmacion para continuar.",
      side: "top",
      interactive: true,
    },
    {
      target: TOUR_ANCHORS.faceSwapRun,
      title: "Inicia el reemplazo",
      description:
        "Cuando tengas el video, la imagen y el permiso, este boton se activa y empieza el proceso.",
      side: "top",
      interactive: true,
    },
  ],
};

export function stepsForMission(missionId: string): readonly TourStep[] {
  return MISSION_STEPS[missionId] ?? [];
}
