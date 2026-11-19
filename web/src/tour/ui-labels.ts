/**
 * Single source for the UI labels quoted by tour copy.
 *
 * Tour copy is Spanish WITHOUT accents (project convention), so accented UI
 * text is stored in its accent-free form here (for example the real label is
 * "Direccion visual del videoclip" with an accent on the o). The drift guard
 * in ui-labels.test.ts compares them accent- and case-insensitively against
 * the component that renders each label.
 */
export const UI_LABELS = {
  newProject: "Nuevo proyecto",
  createProject: "Crear proyecto",
  projectName: "Nombre",
  projectDescription: "Descripcion",
  uploadVideo: "Subir video",
  createKaraoke: "Crear karaoke",
  sing: "Cantar",
  startSinging: "Comenzar a cantar",
  saveRecording: "Guardar interpretacion",
  uploadMusic: "Subir musica",
  analyzePlan: "Analizar y crear plan",
  produceVideoclip: "Generar videoclip",
  startSwap: "Iniciar reemplazo",
  startSwapMany: "Reemplazar",
  uploadImage: "Subir imagen",
  changeImage: "Cambiar imagen",
  changeVideo: "Cambiar video",
  peopleToReplace: "Personas a reemplazar",
  visualDirection: "Direccion visual del videoclip",
  suggestedStyles: "Estilos sugeridos",
  consentPanel: "Confirmacion",
  consentText: "Confirmo que tengo derechos o autorizacion sobre los archivos",
  missingPrefix: "Falta:",
} as const;

export type UiLabelKey = keyof typeof UI_LABELS;

/** Quotes a label the way tour copy writes button names. */
export const q = (label: string): string => `"${label}"`;
