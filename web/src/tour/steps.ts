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
  /** Tried when `target` has no visible element (e.g. dropzone gone). */
  fallbackTarget?: TourAnchorName;
  title: string;
  description: string;
  side: TourStepSide;
  /** The user can click or type inside the highlighted element. */
  interactive: boolean;
  /** One short imperative sentence naming the exact control to use. */
  action?: string;
  /** Form controls involved in this step, with what to put in each. */
  fields?: readonly TourField[];
  /**
   * The element only exists AFTER the user acts on the previous step (for
   * example a modal opened by that step's button). The runner waits for it
   * instead of skipping the step.
   */
  late?: boolean;
  /** Move keyboard focus to the highlighted control instead of the popover. */
  focusTarget?: boolean;
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
    {
      target: TOUR_ANCHORS.projectName,
      title: `Escribe el ${q(L.projectName)}`,
      description:
        "Es el unico dato obligatorio. Elige un nombre que reconozcas despues en tu lista de proyectos.",
      fields: [
        {
          label: L.projectName,
          value: `Por ejemplo "Mi primer videoclip".`,
          required: true,
          note: "maximo 100 caracteres",
        },
      ],
      side: "right",
      interactive: true,
      late: true,
      focusTarget: true,
    },
    {
      target: TOUR_ANCHORS.projectDescription,
      title: `Cuenta de que trata (${q(L.projectDescription)})`,
      description:
        "Una frase con el objetivo de la produccion. Puedes dejarla vacia y completarla mas tarde.",
      fields: [
        {
          label: L.projectDescription,
          value: `Por ejemplo "Videoclip de mi cancion nueva".`,
          required: false,
          note: "maximo 500 caracteres",
        },
      ],
      side: "right",
      interactive: true,
      late: true,
      focusTarget: true,
    },
    {
      target: TOUR_ANCHORS.projectSubmit,
      title: `Pulsa ${q(L.createProject)}`,
      description:
        "Se crea el proyecto y se abre enseguida para que subas tus videos y tu musica. Si falta el nombre, el formulario te lo avisara.",
      action: `Pulsa ${q(L.createProject)}.`,
      side: "top",
      interactive: true,
      late: true,
    },
  ],
  "upload-video": [
    {
      target: TOUR_ANCHORS.karaokeDropzone,
      fallbackTarget: TOUR_ANCHORS.karaokeUpload,
      title: `Sube tu video con ${q(L.uploadVideo)}`,
      description:
        "Para el karaoke necesitas un video con musica y con la letra cantada. De ahi sacamos la voz y la pista.",
      action: `Arrastra el archivo al recuadro o pulsa ${q(L.uploadVideo)} y elige un video (MP4, MPEG, MOV, AVI o WebM).`,
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
      target: TOUR_ANCHORS.musicDropzone,
      fallbackTarget: TOUR_ANCHORS.musicUpload,
      title: `Sube tu pieza con ${q(L.uploadMusic)}`,
      description:
        "La pieza musical es la base del videoclip: con ella armamos las escenas.",
      action: `Arrastra el archivo al recuadro o pulsa ${q(L.uploadMusic)} y elige tu pieza (audio como MP3 o M4A, o MP4/MPEG).`,
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
      target: TOUR_ANCHORS.faceSwapImageDropzone,
      fallbackTarget: TOUR_ANCHORS.faceSwapImageButton,
      title: "Sube la foto del rostro",
      description:
        "Es el rostro que se pondra en el video. Usa una foto clara y de frente.",
      action: `Arrastra una foto (PNG, JPG o WebP) al recuadro o pulsa ${q(L.uploadImage)}. Si ya hay una imagen en el proyecto, elige otra en la lista o pulsa ${q(L.changeImage)}.`,
      side: "right",
      interactive: true,
    },
    {
      target: TOUR_ANCHORS.faceSwapVideoDropzone,
      fallbackTarget: TOUR_ANCHORS.faceSwapVideoButton,
      title: "Sube el video donde se reemplazaran los rostros",
      description:
        "Al elegir el video empieza solo la deteccion de personas; puede tardar un poco.",
      action: `Arrastra el video (MP4, MPEG, MOV, AVI o WebM) al recuadro o pulsa ${q(L.uploadVideo)}. Si ya hay uno, elige otro en la lista o pulsa ${q(L.changeVideo)}.`,
      side: "left",
      interactive: true,
    },
    {
      // Only rendered once automatic detection has finished: when it is
      // missing at start the runner skips this step silently.
      target: TOUR_ANCHORS.faceSwapPeople,
      title: `Elige a quien reemplazar (${q(L.peopleToReplace)})`,
      description:
        "Esta lista aparece cuando termina la deteccion de personas del video; si todavia no se ve, espera a que termine. Si el video tiene una sola persona, se selecciona sola.",
      action:
        "Pulsa la tarjeta de al menos una persona para seleccionarla (puedes elegir varias).",
      side: "top",
      interactive: true,
    },
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
      description: `Cuando tengas la imagen, el video, al menos una persona elegida y la confirmacion, este boton se activa y empieza el proceso. Si elegiste varias personas el boton dice ${q(`${L.startSwapMany} N personas`)}. ${MISSING_HINT}`,
      action: `Pulsa ${q(L.startSwap)} (o ${q(`${L.startSwapMany} N personas`)}).`,
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
