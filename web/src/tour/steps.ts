import { TOUR_ANCHORS, type TourAnchorName } from "./anchors";
import { UI_LABELS as L, q } from "./ui-labels";

export type TourStepSide = "top" | "right" | "bottom" | "left";

/** A form control the user must (or may) fill during a step. */
export type TourField = {
  /** Real label of the control as shown in the UI. */
  label: string;
  /** What to put there (instruction or example). */
  value: string;
  required: boolean;
  /** Limit or extra detail, e.g. a maximum length. */
  note?: string;
};

/** One highlighted element inside a micro-tour. Pure data. */
export type TourStep = {
  target: TourAnchorName;
  title: string;
  description: string;
  side: TourStepSide;
  /** The user can click or type inside the highlighted element. */
  interactive: boolean;
  /** One short imperative sentence naming the exact control to use. */
  action?: string;
  /** Form controls involved in this step, with what to put in each. */
  fields?: readonly TourField[];
};

const MISSING_HINT = `Si el boton esta desactivado, la linea ${q(L.missingPrefix)} justo debajo dice que falta.`;

/**
 * Micro-tour steps per mission id. Copy says WHAT TO DO (exact control names
 * come from UI_LABELS) and briefly why, in plain Spanish (ASCII only, project
 * convention). Nothing here targets the singing modal: the sing step points
 * at the button that opens it and describes the modal in text.
 */
export const MISSION_STEPS: Readonly<Record<string, readonly TourStep[]>> = {
  "create-project": [
    {
      target: TOUR_ANCHORS.newProject,
      title: `Pulsa ${q(L.newProject)}`,
      description:
        "Un proyecto reune tus videos, tu musica y los resultados en un solo lugar.",
      action: `Pulsa ${q(L.newProject)} para abrir el formulario.`,
      side: "bottom",
      interactive: true,
    },
  ],
  "upload-video": [
    {
      target: TOUR_ANCHORS.karaokeUpload,
      title: `Pulsa ${q(L.uploadVideo)}`,
      description:
        "Para el karaoke necesitas un video con musica y con la letra cantada. De ahi sacamos la voz y la pista.",
      action: `Pulsa ${q(L.uploadVideo)} y elige un video (MP4, MPEG, MOV, AVI o WebM).`,
      side: "bottom",
      interactive: true,
    },
  ],
  "create-karaoke": [
    {
      target: TOUR_ANCHORS.karaokeCreate,
      title: `Pulsa ${q(L.createKaraoke)}`,
      description: `Separamos la voz de la musica y sincronizamos la letra. Puede tardar unos minutos y puedes seguir usando la app. ${MISSING_HINT}`,
      action: `Pulsa ${q(L.createKaraoke)}.`,
      side: "top",
      interactive: true,
    },
  ],
  "sing-karaoke": [
    {
      target: TOUR_ANCHORS.karaokeSing,
      title: `Pulsa ${q(L.sing)}`,
      description: `Se abre una ventana para grabarte con la musica de fondo. Ahi: pulsa ${q(L.startSinging)}, permite el acceso al microfono, ponle nombre a la pieza y pulsa ${q(L.saveRecording)}.`,
      action: `Pulsa ${q(L.sing)} para abrir la ventana de grabacion.`,
      side: "top",
      interactive: true,
    },
  ],
  "upload-music": [
    {
      target: TOUR_ANCHORS.musicUpload,
      title: `Pulsa ${q(L.uploadMusic)}`,
      description:
        "La pieza musical es la base del videoclip: con ella armamos las escenas.",
      action: `Pulsa ${q(L.uploadMusic)} y elige tu pieza (audio como MP3 o M4A, o MP4/MPEG).`,
      side: "bottom",
      interactive: true,
    },
  ],
  "create-plan": [
    {
      target: TOUR_ANCHORS.musicPrompt,
      title: `Rellena ${q(L.visualDirection)}`,
      description:
        "Describe el estilo o la historia que imaginas. Es obligatoria: ya trae un ejemplo que puedes cambiar.",
      action: `Escribe en ${q(L.visualDirection)} o elige un preset.`,
      fields: [
        {
          label: L.visualDirection,
          value: `Tu idea visual, por ejemplo "estetica retro con luces de neon". Ya hay un texto de ejemplo: cambialo o elige un preset bajo ${q(L.suggestedStyles)}.`,
          required: true,
          note: "maximo 500 caracteres",
        },
      ],
      side: "top",
      interactive: true,
    },
    {
      target: TOUR_ANCHORS.musicPlan,
      title: `Pulsa ${q(L.analyzePlan)}`,
      description: `Analizamos la musica y proponemos las escenas para que las revises antes de producir. ${MISSING_HINT}`,
      action: `Pulsa ${q(L.analyzePlan)}.`,
      side: "top",
      interactive: true,
    },
  ],
  "generate-videoclip": [
    {
      target: TOUR_ANCHORS.musicProduce,
      title: `Pulsa ${q(L.produceVideoclip)}`,
      description: `Con el plan listo producimos cada clip y los unimos. Es la fase mas larga y te avisaremos al terminar. ${MISSING_HINT}`,
      action: `Pulsa ${q(L.produceVideoclip)}.`,
      side: "top",
      interactive: true,
    },
  ],
  "face-swap": [
    {
      target: TOUR_ANCHORS.faceSwapConsent,
      title: `Marca la casilla de ${q(L.consentPanel)}`,
      description:
        "Solo puedes reemplazar rostros con archivos que tengas derecho a usar. Sin esta casilla no se puede continuar.",
      action: `Marca la casilla de ${q(L.consentPanel)}.`,
      fields: [
        {
          label: L.consentText,
          value: "Marca la casilla para confirmar que tienes los derechos.",
          required: true,
        },
      ],
      side: "top",
      interactive: true,
    },
    {
      target: TOUR_ANCHORS.faceSwapRun,
      title: `Pulsa ${q(L.startSwap)}`,
      description: `Cuando tengas el video, la imagen y el permiso, este boton se activa y empieza el proceso. ${MISSING_HINT}`,
      action: `Pulsa ${q(L.startSwap)}.`,
      side: "top",
      interactive: true,
    },
  ],
};

/**
 * Extra hint shown when a mission's tour could not start (first anchor never
 * appeared). Optional per mission; ASCII only.
 */
export const MISSION_UNAVAILABLE_HINTS: Readonly<Record<string, string>> = {
  "sing-karaoke":
    "Para cantar primero necesitas un karaoke listo: usa Crear karaoke.",
};

export const TOUR_UNAVAILABLE_MESSAGE =
  "Todavia no podemos mostrar este paso. Espera a que cargue la pagina o completa el paso anterior.";

export function stepsForMission(missionId: string): readonly TourStep[] {
  return MISSION_STEPS[missionId] ?? [];
}
