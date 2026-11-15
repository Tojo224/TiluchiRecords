import type { StoryboardScene } from "@/shared/types/domain";

export function scenePhase(index: number, total: number) {
  if (index === 0) return "Apertura";
  if (index === total - 1) return "Cierre";
  if (total > 2 && index === total - 2) return "Punto alto";
  return "Desarrollo";
}

export function formatTimelineTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

export function friendlySceneDescription(
  scene: StoryboardScene,
  index: number,
  total: number,
) {
  if (scene.title) return scene.description;

  const visualIdea = scene.description.split(/\. Escena \d+/i)[0].trim();
  const phase = scenePhase(index, total);
  const action =
    phase === "Apertura"
      ? "Presenta el ambiente y la idea principal"
      : phase === "Desarrollo"
        ? "Desarrolla la idea con nuevos encuadres y movimiento"
        : phase === "Punto alto"
          ? "Aumenta la energia visual y acelera los cambios"
          : "Cierra la secuencia y resuelve la idea visual";
  return `${action}. Concepto: ${visualIdea}.`;
}

export function intensityLabel(
  scene: StoryboardScene,
  index: number,
  total: number,
) {
  if (scene.intensity) return `Intensidad: ${scene.intensity}`;
  const phase = scenePhase(index, total);
  if (phase === "Apertura") return "Intensidad: suave";
  if (phase === "Punto alto") return "Intensidad: alta";
  if (phase === "Cierre") return "Intensidad: final";
  return "Intensidad: media";
}

export function shotTypeLabel(value: NonNullable<StoryboardScene["shotType"]>) {
  if (value === "PERFORMANCE") return "Interpretacion";
  if (value === "ESTABLISHING") return "Ambiente";
  return "Narrativa";
}

export function clipStageLabel(
  stage?: string,
  sceneIndex?: number,
  sceneCount?: number,
) {
  const scene =
    sceneIndex && sceneCount ? ` - escena ${sceneIndex} de ${sceneCount}` : "";
  if (stage === "keyframes") return `Creando escenas y fondos${scene}`;
  if (stage === "animation") return `Generando movimiento${scene}`;
  if (stage === "identity_and_lips")
    return `Sincronizando rostro y canto${scene}`;
  if (stage === "encoding") return "Codificando clips";
  return "Preparando videoclip";
}
