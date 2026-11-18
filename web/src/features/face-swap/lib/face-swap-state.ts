import { BUSY_REASON } from "@/shared/lib/blockers";
import { formatDuration } from "@/shared/lib/format";

export type FaceIdentity = {
  id: string;
  label: string;
  thumbnailDataUrl: string;
  referenceFrameNumber: number;
  referenceFacePosition: number;
  timestampSeconds: number;
  appearanceCount: number;
  confidence: number;
};

export function formatVideoDuration(seconds: number) {
  if (!seconds) return "Duracion por detectar";
  const total = Math.max(0, Math.round(seconds));
  if (total < 3600) return formatDuration(total);
  // Videos of one hour or more keep the h:mm:ss format used before the refactor.
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export type FaceSwapBlockerInput = {
  hasImage: boolean;
  hasVideo: boolean;
  busy: boolean;
  analysisRunning: boolean;
  swapRunning: boolean;
  identityCount: number;
  selectedCount: number;
  consent: boolean;
};

/** Requirements still missing before the face swap can start. */
export function getFaceSwapBlockers(input: FaceSwapBlockerInput): string[] {
  const blockers: string[] = [];
  if (input.busy || input.analysisRunning || input.swapRunning) {
    blockers.push(BUSY_REASON);
  }
  if (!input.hasImage) blockers.push("subir o seleccionar una imagen");
  if (!input.hasVideo) blockers.push("subir o seleccionar un video");
  if (input.selectedCount === 0) {
    blockers.push(
      input.identityCount === 0
        ? "esperar la deteccion de personas y elegir a quien reemplazar"
        : "elegir al menos una persona a reemplazar",
    );
  }
  if (!input.consent) blockers.push("aceptar la confirmacion");
  return blockers;
}

export function sameIdentitySelection(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();
  return normalizedLeft.every(
    (identityId, index) => identityId === normalizedRight[index],
  );
}
