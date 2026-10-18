import {
  ArrowRight,
  FileVideo2,
  FolderOpen,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { FileUpload } from "../../media/components/FileUpload";
import { MediaPlayer } from "../../media/components/MediaPlayer";
import { useSelectedAsset } from "../../media/hooks/useSelectedAsset";
import { formatBytes } from "../../../shared/lib/format";
import { VIDEO_FILE_ACCEPT } from "../../../shared/media/asset-files";
import type { MediaAsset } from "../../../shared/types/domain";
import { useProject } from "../../projects/context/ProjectContext";

export function KaraokePage() {
  const { project, assetUrls, uploadFile, createJob, downloadAsset } =
    useProject();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const videos = useMemo(
    () =>
      (project.mediaAssets || []).filter(
        (asset) =>
          asset.status === "READY" &&
          asset.mimeType.startsWith("video/") &&
          ["ORIGINAL_VIDEO", "FACE_SWAP_SOURCE_VIDEO"].includes(asset.kind),
      ),
    [project.mediaAssets],
  );
  const {
    selectedAsset: video,
    selectedId: videoId,
    setSelectedId: setVideoId,
  } = useSelectedAsset(videos);
  const karaokeJob = (project.jobs || []).find(
    (job) =>
      job.type === "GENERATE_KARAOKE" && job.payload?.videoAssetId === videoId,
  );
  const karaokeVideo = (project.mediaAssets || []).find(
    (asset) =>
      asset.kind === "KARAOKE_VIDEO" &&
      asset.status === "READY" &&
      asset.metadata?.sourceJobId === karaokeJob?.id,
  );
  const processing = ["PENDING", "PROCESSING"].includes(
    karaokeJob?.status || "",
  );

  async function upload(file: File) {
    try {
      const asset = await uploadFile(file, file.name, "ORIGINAL_VIDEO");
      setVideoId(asset.id);
      setMessage("Video subido correctamente.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function generate() {
    if (!video) return setMessage("Selecciona primero un video con musica.");
    setBusy(true);
    try {
      await createJob("GENERATE_KARAOKE", { videoAssetId: video.id });
      setMessage("Generacion de karaoke iniciada.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const stage = karaokeStage(karaokeJob?.result?.stage);
  const failed = karaokeJob?.status === "FAILED";
  const statusMessage = failed
    ? friendlyKaraokeError(karaokeJob.errorMessage)
    : message;

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0b171c] dark:shadow-black/20">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 px-5 py-5 dark:border-white/10 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              <Settings2 size={27} />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
                Configuracion del proyecto
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Selecciona el video de origen y genera la version karaoke de{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {project.name}
                </span>
                .
              </p>
            </div>
          </div>
          <FileUpload
            accept={VIDEO_FILE_ACCEPT}
            label="Subir video"
            busy={busy || processing}
            onSelect={upload}
          />
        </header>

        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end">
          <VideoPicker
            assets={videos}
            value={videoId}
            selected={video}
            disabled={busy || processing}
            onChange={setVideoId}
          />

          <div>
            <Button
              onClick={generate}
              disabled={busy || processing || !video}
              className="min-h-14 w-full justify-between bg-emerald-600 px-5 text-base text-white shadow-lg shadow-emerald-600/15 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
            >
              <span className="flex items-center gap-3">
                <Sparkles size={20} />
                {processing ? "Generando karaoke..." : "Crear karaoke"}
              </span>
              <ArrowRight size={21} />
            </Button>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Se generara una version instrumental con la letra sincronizada en
              pantalla.
            </p>
          </div>

          {processing && karaokeJob && (
            <div
              className="lg:col-span-2 rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]"
              aria-live="polite"
            >
              <div className="mb-2 flex justify-between gap-4 text-sm">
                <span className="font-medium text-emerald-900 dark:text-emerald-200">
                  {stage}
                </span>
                <span className="tabular-nums text-emerald-700 dark:text-emerald-300">
                  {karaokeJob.progress}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-emerald-200 dark:bg-emerald-950">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 dark:bg-emerald-400"
                  style={{ width: `${karaokeJob.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <Notice
        message={statusMessage}
        tone={
          failed || (!message.includes("correctamente") && !processing)
            ? "error"
            : "success"
        }
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <MediaPlayer
          title="Video original"
          asset={video}
          url={video && assetUrls[video.id]}
          onDownload={downloadAsset}
        />
        <MediaPlayer
          title="Video karaoke"
          asset={karaokeVideo}
          url={karaokeVideo && assetUrls[karaokeVideo.id]}
          onDownload={downloadAsset}
        />
      </section>
    </>
  );
}

function VideoPicker({
  assets,
  value,
  selected,
  disabled,
  onChange,
}: {
  assets: MediaAsset[];
  value: string;
  selected?: MediaAsset;
  disabled: boolean;
  onChange: (assetId: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Video del proyecto
      </p>
      <label className="relative flex min-h-[78px] cursor-pointer items-center gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 transition hover:border-emerald-400 dark:border-white/10 dark:bg-[#081216] dark:hover:border-emerald-500/50">
        <select
          aria-label="Video del proyecto"
          value={value}
          disabled={disabled || assets.length === 0}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 z-10 h-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        >
          {assets.length === 0 ? (
            <option value="">No hay videos disponibles</option>
          ) : (
            assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))
          )}
        </select>
        <span className="grid size-12 shrink-0 place-items-center rounded-md bg-white text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-200">
          <FileVideo2 size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm font-medium text-zinc-950 dark:text-white">
            {selected?.name || "No hay videos disponibles"}
          </strong>
          <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
            {selected
              ? `${videoFormat(selected)} · ${formatBytes(selected.sizeBytes)}`
              : "Sube un video para comenzar"}
          </span>
        </span>
        {selected && (
          <span className="hidden shrink-0 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200 sm:flex">
            <FolderOpen size={17} />
            Cambiar
          </span>
        )}
      </label>
    </div>
  );
}

function videoFormat(asset: MediaAsset) {
  const extension = asset.name.split(".").pop()?.toUpperCase();
  const duration = Number(
    asset.durationSeconds || asset.metadata?.durationSeconds || 0,
  );
  return [extension || "VIDEO", duration ? formatDuration(duration) : null]
    .filter(Boolean)
    .join(" · ");
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function karaokeStage(stage?: string) {
  const stages: Record<string, string> = {
    downloading: "Preparando video",
    extracting_audio: "Extrayendo audio",
    separating_vocals: "Creando instrumental",
    transcribing_lyrics: "Reconociendo letra",
    building_subtitles: "Sincronizando palabras",
    rendering_video: "Renderizando video karaoke",
    uploading: "Guardando resultado",
  };
  return stages[stage || ""] || "Procesando karaoke";
}

function friendlyKaraokeError(error?: string | null) {
  const detail = error || "";
  if (detail.includes("matches no streams") || detail.includes("0:v:0")) {
    return "El archivo seleccionado no contiene una pista de video. Selecciona un video MP4 o MPEG valido.";
  }
  if (detail.includes("No se detecto una letra")) {
    return "No se pudo reconocer suficiente letra cantada en este video. Prueba con una pista donde la voz sea mas clara.";
  }
  return "No se pudo generar el karaoke. Revisa el video seleccionado o vuelve a intentarlo.";
}
