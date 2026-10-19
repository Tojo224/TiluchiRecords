import {
  Download,
  Eye,
  FileVideo2,
  Loader2,
  Mic2,
  Video,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { formatBytes } from "../../../shared/lib/format";
import { makeRecordingSeekable } from "../../../shared/media/seekable-recording";
import type { MediaAsset } from "../../../shared/types/domain";

export function MediaPlayer({
  title,
  asset,
  url,
  onDownload,
  action,
  compact = false,
}: {
  title: string;
  asset?: MediaAsset;
  url?: string;
  onDownload: (id: string) => void;
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  compact?: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSource, setPreviewSource] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const karaoke =
    asset?.kind === "KARAOKE_VIDEO" ||
    asset?.kind === "KARAOKE_PERFORMANCE_VIDEO" ||
    title.toLowerCase().includes("karaoke");
  const duration = Number(
    asset?.durationSeconds || asset?.metadata?.durationSeconds || 0,
  );
  const width = asset?.metadata?.width;
  const height = asset?.metadata?.height;

  useEffect(() => {
    if (!previewOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [previewOpen]);

  useEffect(() => {
    if (!previewOpen || !url || !asset) return;
    if (!asset.mimeType.toLowerCase().includes("webm")) {
      setPreviewSource(url);
      setPreviewError("");
      return;
    }

    const controller = new AbortController();
    let objectUrl = "";
    setPreviewLoading(true);
    setPreviewSource("");
    setPreviewError("");
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar el video.");
        const source = new Blob([await response.arrayBuffer()], {
          type: asset.mimeType,
        });
        return makeRecordingSeekable(source, duration);
      })
      .then((seekable) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(seekable);
        setPreviewSource(objectUrl);
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setPreviewError(
          (caught as Error).message || "No se pudo preparar el video.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setPreviewLoading(false);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset?.id, asset?.mimeType, duration, previewOpen, url]);

  if (compact && asset) {
    return (
      <>
        <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0b171c] dark:shadow-black/20">
          <footer className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
            <AssetInformation
              asset={asset}
              duration={duration}
              width={width}
              height={height}
            />
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button
                variant="icon"
                title="Ver video"
                aria-label={`Ver ${asset.name}`}
                disabled={!url}
                onClick={() => setPreviewOpen(true)}
              >
                <Eye size={18} />
              </Button>
              <Button variant="ghost" onClick={() => onDownload(asset.id)}>
                <Download size={17} />
                Descargar
              </Button>
            </div>
          </footer>
        </article>

        {previewOpen && url && (
          <div
            className="fixed inset-0 z-[80] grid place-items-center bg-zinc-950/85 p-3 backdrop-blur-sm sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`preview-title-${asset.id}`}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPreviewOpen(false);
            }}
          >
            <section className="w-full max-w-5xl overflow-hidden rounded-lg border border-white/15 bg-white shadow-2xl dark:bg-[#071217]">
              <header className="flex min-h-16 items-center justify-between gap-4 border-b border-zinc-200 px-4 dark:border-white/10 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <Mic2 size={20} />
                  </span>
                  <div className="min-w-0">
                    <h2
                      id={`preview-title-${asset.id}`}
                      className="truncate text-sm font-semibold text-zinc-950 dark:text-white"
                    >
                      Ultima interpretacion
                    </h2>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {asset.name}
                    </p>
                  </div>
                </div>
                <Button
                  variant="icon"
                  aria-label="Cerrar vista del video"
                  title="Cerrar"
                  onClick={() => setPreviewOpen(false)}
                >
                  <X size={18} />
                </Button>
              </header>
              <div className="bg-black">
                {previewLoading ? (
                  <div className="grid aspect-video max-h-[78vh] w-full place-items-center text-zinc-300">
                    <span className="flex items-center gap-2 text-sm">
                      <Loader2 className="animate-spin" size={20} />
                      Preparando reproduccion...
                    </span>
                  </div>
                ) : previewError ? (
                  <div className="grid aspect-video max-h-[78vh] w-full place-items-center px-6 text-center text-sm text-red-300">
                    {previewError}
                  </div>
                ) : (
                  <video
                    className="mx-auto aspect-video max-h-[78vh] w-full bg-black object-contain"
                    src={previewSource}
                    controls
                    autoPlay
                    playsInline
                    preload="metadata"
                  />
                )}
              </div>
            </section>
          </div>
        )}
      </>
    );
  }

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
          <AssetInformation
            asset={asset}
            duration={duration}
            width={width}
            height={height}
          />
          <div className="flex items-center gap-2">
            {action && (
              <Button onClick={action.onClick} disabled={action.disabled}>
                <Mic2 size={17} />
                {action.label}
              </Button>
            )}
            <Button variant="ghost" onClick={() => onDownload(asset.id)}>
              <Download size={17} />
              Descargar
            </Button>
          </div>
        </footer>
      )}
    </article>
  );
}

function AssetInformation({
  asset,
  duration,
  width,
  height,
}: {
  asset: MediaAsset;
  duration: number;
  width?: number;
  height?: number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <FileVideo2
        className="shrink-0 text-zinc-500 dark:text-zinc-400"
        size={22}
      />
      <div className="min-w-0">
        <strong className="block max-w-52 truncate text-xs font-medium sm:max-w-96">
          {asset.name}
        </strong>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>
            {duration ? formatDuration(duration) : "Duracion original"}
          </span>
          <span>{width && height ? `${width} x ${height}` : "Video"}</span>
          <span>{formatBytes(asset.sizeBytes)}</span>
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}
