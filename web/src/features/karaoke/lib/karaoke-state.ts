import { BUSY_REASON } from "@/shared/lib/blockers";

/** Requirements still missing before "Crear karaoke" can be used. */
export function getKaraokeBlockers({
  hasVideo,
  busy,
}: {
  hasVideo: boolean;
  busy: boolean;
}): string[] {
  const blockers: string[] = [];
  if (busy) blockers.push(BUSY_REASON);
  if (!hasVideo) blockers.push("subir o seleccionar un video con musica");
  return blockers;
}
