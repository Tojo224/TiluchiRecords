import { fixWebmDuration } from "@fix-webm-duration/fix";

export async function makeRecordingSeekable(
  blob: Blob,
  durationSeconds: number,
) {
  if (!blob.type.toLowerCase().includes("webm")) return blob;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return blob;
  return fixWebmDuration(blob, Math.round(durationSeconds * 1000));
}
