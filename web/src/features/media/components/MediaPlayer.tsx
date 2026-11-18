import {
  Download,
  Eye,
  FileVideo2,
  Loader2,
  Mic2,
  Music,
  Pause,
  Play,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const isAudio =
    asset?.mimeType.startsWith("audio/") ||
    ["ORIGINAL_AUDIO", "INSTRUMENTAL_STEM", "VOCAL_STEM", "RECORDED_TAKE", "FINAL_MIX"].includes(
      asset?.kind || "",
    );

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
        <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:border-zinc-300 dark:border-white/10 dark:bg-[#0b171c] dark:shadow-black/20">
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
                title="Ver contenido"
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
            <section className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl dark:bg-[#071217]">
              <header className="flex min-h-16 items-center justify-between gap-4 border-b border-zinc-200 px-4 dark:border-white/10 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    {karaoke ? <Mic2 size={20} /> : isAudio ? <Music size={20} /> : <Video size={20} />}
                  </span>
                  <div className="min-w-0">
                    <h2
                      id={`preview-title-${asset.id}`}
                      className="truncate text-sm font-semibold text-zinc-950 dark:text-white"
                    >
                      {title}
                    </h2>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {asset.name}
                    </p>
                  </div>
                </div>
                <Button
                  variant="icon"
                  aria-label="Cerrar vista"
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
                      <Loader2 className="animate-spin text-emerald-400" size={20} />
                      Preparando reproducción...
                    </span>
                  </div>
                ) : previewError ? (
                  <div className="grid aspect-video max-h-[78vh] w-full place-items-center px-6 text-center text-sm text-red-300">
                    {previewError}
                  </div>
                ) : isAudio ? (
                  <div className="p-8">
                    <StudioAudioVisualizer url={previewSource || url} name={asset.name} duration={duration} />
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
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:border-zinc-300 dark:border-white/10 dark:bg-[#0b171c] dark:shadow-black/20">
      <header className="flex min-h-[70px] items-center gap-3 border-b border-zinc-200 px-4 dark:border-white/10">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-xl shadow-sm ${
            karaoke
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
              : isAudio
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          }`}
        >
          {karaoke ? <Mic2 size={22} /> : isAudio ? <Music size={22} /> : <Video size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <strong className="block text-sm font-semibold text-zinc-950 dark:text-white">
              {title}
            </strong>
            {asset && (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                {asset.kind.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
            {asset?.name || "Pendiente de procesamiento"}
          </span>
        </div>
      </header>

      <div className="bg-zinc-950">
        {asset ? (
          url ? (
            isAudio ? (
              <div className="p-6">
                <StudioAudioVisualizer url={url} name={asset.name} duration={duration} />
              </div>
            ) : asset.mimeType.startsWith("video/") ? (
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
              <div className="grid aspect-video place-items-center bg-zinc-900 p-6">
                <audio className="w-full" controls src={url} />
              </div>
            )
          ) : (
            <div className="grid aspect-video place-items-center text-zinc-400">
              <span className="flex items-center gap-2 text-xs">
                <Loader2 className="animate-spin text-emerald-500" size={20} />
                Cargando recurso seguro...
              </span>
            </div>
          )
        ) : (
          <div className="grid aspect-video place-items-center bg-zinc-100 text-center dark:bg-[#081216]">
            <div className="grid justify-items-center gap-3 px-6 text-zinc-500 dark:text-zinc-400">
              <FileVideo2 size={32} strokeWidth={1.5} />
              <p className="text-sm font-medium">Aún no hay contenido disponible.</p>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                Inicia el pipeline para generar este artefacto
              </span>
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

function StudioAudioVisualizer({
  url,
  name,
  duration: propDuration,
}: {
  url: string;
  name: string;
  duration?: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(propDuration || 0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }

  function toggleMute() {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5 shadow-2xl">
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Header and Waveform Visualizer */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 transition-transform hover:scale-105 active:scale-95"
            aria-label={isPlaying ? "Pausar" : "Reproducir"}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-bold text-white">{name}</h4>
            <span className="text-[11px] font-medium text-emerald-400">
              {isPlaying ? "En reproducción..." : "Listo para reproducir"}
            </span>
          </div>
        </div>

        {/* Dynamic sound wave frequency animation */}
        <div className="flex items-end gap-1 h-8 px-2">
          {[40, 75, 55, 90, 60, 85, 45, 95, 70, 50, 80, 65, 90, 45, 80, 60].map(
            (height, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-emerald-500/80 transition-all duration-150"
                style={{
                  height: isPlaying ? `${Math.max(15, (height * (i % 3 + 1)) % 100)}%` : "20%",
                  opacity: isPlaying ? 0.9 : 0.3,
                }}
              />
            ),
          )}
        </div>
      </div>

      {/* Scrubbing Bar */}
      <div className="space-y-1.5">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 font-mono">
          <span>{formatDuration(currentTime)}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="text-zinc-400 hover:text-white transition-colors"
              aria-label={isMuted ? "Activar sonido" : "Silenciar"}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>
      </div>
    </div>
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
  const isAudio = asset.mimeType.startsWith("audio/");
  return (
    <div className="flex min-w-0 items-center gap-3">
      {isAudio ? (
        <Music className="shrink-0 text-emerald-500 dark:text-emerald-400" size={22} />
      ) : (
        <FileVideo2 className="shrink-0 text-zinc-500 dark:text-zinc-400" size={22} />
      )}
      <div className="min-w-0">
        <strong className="block max-w-52 truncate text-xs font-semibold sm:max-w-96 text-zinc-900 dark:text-white">
          {asset.name}
        </strong>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>{duration ? formatDuration(duration) : "Duración variable"}</span>
          <span>{width && height ? `${width} x ${height}` : asset.mimeType.split("/")[1]?.toUpperCase()}</span>
          {asset.sizeBytes ? <span>{formatBytes(Number(asset.sizeBytes))}</span> : null}
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
