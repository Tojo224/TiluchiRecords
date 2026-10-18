import { Download, FileVideo2, Loader2, Mic2, Video } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { formatBytes } from "../../../shared/lib/format";
import type { MediaAsset } from "../../../shared/types/domain";

export function MediaPlayer({
  title,
  asset,
  url,
  onDownload,
}: {
  title: string;
  asset?: MediaAsset;
  url?: string;
  onDownload: (id: string) => void;
}) {
  const karaoke = asset?.kind === "KARAOKE_VIDEO" || title.includes("karaoke");
  const duration = Number(
    asset?.durationSeconds || asset?.metadata?.durationSeconds || 0,
  );
  const width = asset?.metadata?.width;
  const height = asset?.metadata?.height;

  return (
    <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0b171c] dark:shadow-black/20">
      <header className="flex min-h-[70px] items-center gap-3 border-b border-zinc-200 px-4 dark:border-white/10">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-md ${
            karaoke
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-700/70 dark:text-zinc-200"
          }`}
        >
          {karaoke ? <Mic2 size={22} /> : <Video size={22} />}
        </span>
        <span className="min-w-0">
          <strong className="block text-sm font-semibold text-zinc-950 dark:text-white">
            {title}
          </strong>
          <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
            {asset?.name || "Pendiente"}
          </span>
        </span>
      </header>

      <div className="bg-zinc-950">
        {asset ? (
          url ? (
            asset.mimeType.startsWith("video/") ? (
              <video
                className="aspect-video w-full bg-black object-contain"
                controls
                preload="metadata"
                src={url}
              />
            ) : asset.mimeType.startsWith("image/") ? (
              <img
                className="aspect-video w-full object-cover"
                src={url}
                alt={asset.name}
              />
            ) : (
              <div className="grid aspect-video place-items-center bg-zinc-900 px-6">
                <audio className="w-full" controls src={url} />
              </div>
            )
          ) : (
            <div className="grid aspect-video place-items-center text-zinc-400">
              <Loader2 className="animate-spin" size={24} />
            </div>
          )
        ) : (
          <div className="grid aspect-video place-items-center bg-zinc-100 text-center dark:bg-[#081216]">
            <div className="grid justify-items-center gap-3 px-6 text-zinc-500 dark:text-zinc-400">
              <FileVideo2 size={30} strokeWidth={1.5} />
              <p className="text-sm">Aun no hay un video disponible.</p>
            </div>
          </div>
        )}
      </div>

      {asset && (
        <footer className="flex flex-wrap items-center justify-between gap-4 bg-zinc-50 px-4 py-4 dark:bg-[#0d1b20]">
          <div className="flex min-w-0 items-center gap-3">
            <FileVideo2
              className="shrink-0 text-zinc-500 dark:text-zinc-400"
              size={22}
            />
            <div className="min-w-0">
              <strong className="block max-w-52 truncate text-xs font-medium sm:max-w-64">
                {asset.name}
              </strong>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>
                  {duration ? formatDuration(duration) : "Duracion original"}
                </span>
                <span>
                  {width && height ? `${width} x ${height}` : "Video"}
                </span>
                <span>{formatBytes(asset.sizeBytes)}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" onClick={() => onDownload(asset.id)}>
            <Download size={17} />
            Descargar
          </Button>
        </footer>
      )}
    </article>
  );
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}
