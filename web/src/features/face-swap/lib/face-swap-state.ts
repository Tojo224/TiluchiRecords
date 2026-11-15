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

export function sameIdentitySelection(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();
  return normalizedLeft.every(
    (identityId, index) => identityId === normalizedRight[index],
  );
}
