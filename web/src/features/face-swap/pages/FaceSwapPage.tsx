import {
  Check,
  FileVideo2,
  Image as ImageIcon,
  Loader2,
  Play,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  UserRound,
  Video,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { Button } from "../../../components/ui/Button";
import { JobProgress } from "../../../components/ui/JobProgress";
import { Notice } from "../../../components/ui/Notice";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Panel } from "../../../components/ui/Panel";
import {
  IMAGE_FILE_ACCEPT,
  VIDEO_FILE_ACCEPT,
} from "../../../shared/media/asset-files";
import { AssetSelect } from "../../media/components/AssetSelect";
import { FileUpload } from "../../media/components/FileUpload";
import { MediaPlayer } from "../../media/components/MediaPlayer";
import { useSelectedAsset } from "../../media/hooks/useSelectedAsset";
import { useProject } from "../../projects/context/ProjectContext";
import { formatBytes } from "../../../shared/lib/format";

type FaceIdentity = {
  id: string;
  label: string;
  thumbnailDataUrl: string;
  referenceFrameNumber: number;
  referenceFacePosition: number;
  timestampSeconds: number;
  appearanceCount: number;
  confidence: number;
};

export function FaceSwapPage() {
  const { api } = useAuth();
  const { project, assetUrls, uploadFile, createJob, downloadAsset, refresh } =
    useProject();
  const [consent, setConsent] = useState(false);
  const [selectedIdentityIds, setSelectedIdentityIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [analysisStartError, setAnalysisStartError] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">(
    "success",
  );
  const requestedAnalysis = useRef(new Set<string>());

  const images = useMemo(
    () =>
      (project.mediaAssets || []).filter(
        (asset) =>
          asset.kind === "FACE_SWAP_SOURCE_IMAGE" && asset.status === "READY",
      ),
    [project.mediaAssets],
  );
  const videos = useMemo(
    () =>
      (project.mediaAssets || []).filter(
        (asset) =>
          ["ORIGINAL_VIDEO", "FACE_SWAP_SOURCE_VIDEO"].includes(asset.kind) &&
          asset.status === "READY",
      ),
    [project.mediaAssets],
  );
  const {
    selectedAsset: image,
    selectedId: imageId,
    setSelectedId: setImageId,
  } = useSelectedAsset(images);
  const {
    selectedAsset: video,
    selectedId: videoId,
    setSelectedId: setVideoId,
  } = useSelectedAsset(videos);

  const analysisJob = (project.jobs || []).find(
    (job) =>
      job.type === "ANALYZE_VIDEO_FACES" &&
      job.payload?.sourceVideoAssetId === videoId,
  );
  const identities = (
    analysisJob?.status === "COMPLETED" &&
    Array.isArray(analysisJob.result?.identities)
      ? analysisJob.result.identities
      : []
  ) as FaceIdentity[];
  const analysisRunning =
    analysisJob?.status === "PENDING" || analysisJob?.status === "PROCESSING";

  const faceSwapJob = (project.jobs || []).find((job) => {
    const jobIdentityIds = Array.isArray(job.payload?.targetIdentityIds)
      ? job.payload.targetIdentityIds
      : job.payload?.targetIdentityId
        ? [job.payload.targetIdentityId]
        : [];
    return (
      job.type === "FACE_SWAP" &&
      job.payload?.sourceImageAssetId === imageId &&
      job.payload?.sourceVideoAssetId === videoId &&
      sameIdentitySelection(jobIdentityIds, selectedIdentityIds)
    );
  });
  const swapRunning =
    faceSwapJob?.status === "PENDING" || faceSwapJob?.status === "PROCESSING";
  const result = (project.mediaAssets || []).find(
    (asset) =>
      asset.kind === "FACE_SWAP_RESULT_VIDEO" &&
      asset.status === "READY" &&
      asset.metadata?.sourceJobId === faceSwapJob?.id,
  );

  useEffect(() => {
    setSelectedIdentityIds([]);
    setAnalysisStartError("");
  }, [videoId]);

  useEffect(() => {
    if (!identities.length) return;
    if (identities.length === 1) {
      setSelectedIdentityIds([identities[0].id]);
      return;
    }
    setSelectedIdentityIds((current) =>
      current.filter((identityId) =>
        identities.some((identity) => identity.id === identityId),
      ),
    );
  }, [identities]);

  useEffect(() => {
    if (!videoId || analysisJob || requestedAnalysis.current.has(videoId)) {
      return;
    }
    requestedAnalysis.current.add(videoId);
    setAnalysisStartError("");
    createJob("ANALYZE_VIDEO_FACES", { sourceVideoAssetId: videoId })
      .then(() => showMessage("Deteccion de personas iniciada."))
      .catch((error) => {
        const value = (error as Error).message;
        setAnalysisStartError(value);
        showMessage(value, "error");
      });
  }, [analysisJob, createJob, videoId]);

  useEffect(() => {
    if (!analysisRunning && !swapRunning) return;
    const interval = window.setInterval(
      () => refresh().catch(() => undefined),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [analysisRunning, refresh, swapRunning]);

  async function retryAnalysis() {
    if (!videoId) return;
    setBusy(true);
    setAnalysisStartError("");
    try {
      await createJob("ANALYZE_VIDEO_FACES", { sourceVideoAssetId: videoId });
      showMessage("Deteccion de personas reiniciada.");
    } catch (error) {
      const value = (error as Error).message;
      setAnalysisStartError(value);
      showMessage(value, "error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    setBusy(true);
    try {
      const asset = await uploadFile(file, file.name, "FACE_SWAP_SOURCE_IMAGE");
      setImageId(asset.id);
      showMessage("Imagen subida correctamente.");
    } catch (error) {
      showMessage((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadVideo(file: File) {
    setBusy(true);
    try {
      const asset = await uploadFile(file, file.name, "ORIGINAL_VIDEO");
      setVideoId(asset.id);
      showMessage("Video subido correctamente.");
    } catch (error) {
      showMessage((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!image || !video) {
      return showMessage("Sube una imagen y un video.", "error");
    }
    if (!analysisJob || analysisJob.status !== "COMPLETED") {
      return showMessage(
        "Espera a que termine la deteccion de personas.",
        "error",
      );
    }
    if (!selectedIdentityIds.length) {
      return showMessage(
        "Selecciona una o varias personas para reemplazar.",
        "error",
      );
    }
    if (!consent) {
      return showMessage("Debes aceptar el consentimiento.", "error");
    }

    setBusy(true);
    try {
      const consentLog = await api<{ id: string }>("/consents/face-swap", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          termsAccepted: true,
          consentText:
            "Confirmo que tengo derechos o autorizacion sobre la imagen usada y acepto utilizar esta funcion de forma responsable.",
        }),
      });
      await createJob("FACE_SWAP", {
        sourceVideoAssetId: video.id,
        sourceImageAssetId: image.id,
        consentLogId: consentLog.id,
        faceAnalysisJobId: analysisJob.id,
        targetIdentityIds: selectedIdentityIds,
      });
      showMessage("Reemplazo facial iniciado.");
    } catch (error) {
      showMessage((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  function showMessage(value: string, tone: "success" | "error" = "success") {
    setMessage(value);
    setMessageTone(tone);
  }

  return (
    <>
      <PageHeader title="Face swap" description={project.name} />
      <Notice message={message} tone={messageTone} />

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel className="overflow-hidden border-emerald-200/80 bg-gradient-to-br from-white via-white to-emerald-50/50 p-0 dark:border-emerald-500/20 dark:from-[#0b171c] dark:via-[#0b171c] dark:to-emerald-950/20">
          <SectionHeading
            icon={<UserRound size={22} />}
            title="Rostro fuente"
            description="Imagen que se usara para reemplazar los rostros."
          />
          <div className="px-5 pb-5">
            <AssetSelect
              label="Imagen del proyecto"
              assets={images}
              value={imageId}
              onChange={setImageId}
              disabled={busy || swapRunning}
            />
            {image && (
              <figure className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 shadow-sm dark:border-white/10 dark:bg-[#061014]">
                <div className="grid h-52 place-items-center sm:h-60 lg:h-64">
                  {assetUrls[image.id] ? (
                    <img
                      className="size-full object-contain"
                      src={assetUrls[image.id]}
                      alt={`Vista previa de ${image.name}`}
                    />
                  ) : (
                    <div className="grid justify-items-center gap-2 text-zinc-500 dark:text-zinc-400">
                      <Loader2 className="animate-spin" size={24} />
                      <span className="text-xs">Cargando vista previa</span>
                    </div>
                  )}
                </div>
                <figcaption className="flex min-w-0 items-center gap-2 border-t border-zinc-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-[#0b171c]">
                  <ImageIcon
                    className="shrink-0 text-emerald-600 dark:text-emerald-400"
                    size={17}
                  />
                  <span className="truncate text-sm font-medium">
                    {image.name}
                  </span>
                </figcaption>
              </figure>
            )}
            <div className="mt-3 flex justify-end">
              <FileUpload
                accept={IMAGE_FILE_ACCEPT}
                label={image ? "Cambiar imagen" : "Subir imagen"}
                busy={busy || swapRunning}
                onSelect={uploadImage}
              />
            </div>
          </div>
        </Panel>

        <Panel className="overflow-hidden border-cyan-200/80 bg-gradient-to-br from-white via-white to-cyan-50/50 p-0 dark:border-cyan-500/20 dark:from-[#0b171c] dark:via-[#0b171c] dark:to-cyan-950/20">
          <SectionHeading
            icon={<Video size={22} />}
            title="Video objetivo"
            description="Video donde se reemplazaran los rostros seleccionados."
          />
          <div className="px-5 pb-5">
            <AssetSelect
              label="Video del proyecto"
              assets={videos}
              value={videoId}
              onChange={setVideoId}
              disabled={busy || analysisRunning || swapRunning}
            />
            {video && (
              <div className="mt-3 grid overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#081216] sm:grid-cols-[minmax(0,1.35fr)_minmax(180px,0.65fr)]">
                <div className="grid min-h-52 place-items-center bg-zinc-950 sm:min-h-64">
                  {assetUrls[video.id] ? (
                    <video
                      className="size-full max-h-64 object-contain"
                      controls
                      preload="metadata"
                      src={assetUrls[video.id]}
                      aria-label={`Vista previa de ${video.name}`}
                    />
                  ) : (
                    <Loader2 className="animate-spin text-zinc-400" size={24} />
                  )}
                </div>
                <div className="flex min-w-0 flex-col justify-between gap-4 border-t border-zinc-200 p-4 dark:border-white/10 sm:border-l sm:border-t-0">
                  <div className="flex min-w-0 gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                      <FileVideo2 size={21} />
                    </span>
                    <div className="min-w-0">
                      <strong className="block truncate text-sm">
                        {video.name}
                      </strong>
                      <div className="mt-2 grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>
                          {formatDuration(
                            Number(
                              video.durationSeconds ||
                                video.metadata?.durationSeconds ||
                                0,
                            ),
                          )}
                        </span>
                        <span>{formatBytes(video.sizeBytes)}</span>
                        <span>
                          {video.mimeType.split("/")[1]?.toUpperCase() ||
                            "VIDEO"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <FileUpload
                    accept={VIDEO_FILE_ACCEPT}
                    label="Cambiar video"
                    busy={busy || analysisRunning || swapRunning}
                    onSelect={uploadVideo}
                  />
                </div>
              </div>
            )}
            {!video && (
              <div className="mt-3 flex min-h-52 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 text-center dark:border-white/10 dark:bg-[#081216]">
                <FileVideo2
                  className="text-zinc-400"
                  size={34}
                  strokeWidth={1.5}
                />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Selecciona o sube el video que deseas editar.
                </p>
                <FileUpload
                  accept={VIDEO_FILE_ACCEPT}
                  label="Subir video"
                  busy={busy || analysisRunning || swapRunning}
                  onSelect={uploadVideo}
                />
              </div>
            )}
          </div>
        </Panel>
      </section>

      <Panel className="border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/30 dark:border-emerald-500/20 dark:from-[#0b171c] dark:to-emerald-950/10">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <SectionHeading
            compact
            icon={<Users size={21} />}
            title="Personas a reemplazar"
            description={
              identities.length
                ? `Detectamos ${identities.length} ${identities.length === 1 ? "persona" : "personas"}. Selecciona una o varias para reemplazarlas.`
                : "La deteccion identifica a cada persona a lo largo del video."
            }
          />
          {identities.length > 0 && (
            <span className="pt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {selectedIdentityIds.length
                ? `${selectedIdentityIds.length} ${selectedIdentityIds.length === 1 ? "persona seleccionada" : "personas seleccionadas"}`
                : "Ninguna persona seleccionada"}
            </span>
          )}
        </div>
        {!video ? (
          <EmptyIdentityState text="Selecciona un video para detectar sus protagonistas." />
        ) : analysisRunning ? (
          <div className="grid gap-4">
            <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
              <ScanFace className="text-emerald-600 dark:text-emerald-400" />
              Analizando rostros e identidades a lo largo del video.
            </div>
            <JobProgress
              label="Detectando personas"
              progress={analysisJob?.progress || 0}
            />
          </div>
        ) : analysisJob?.status === "FAILED" || analysisStartError ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-red-600 dark:text-red-300">
              {analysisJob?.errorMessage ||
                analysisStartError ||
                "No se pudieron detectar los rostros."}
            </p>
            <Button variant="ghost" onClick={retryAnalysis} disabled={busy}>
              <RefreshCw size={17} />
              Reintentar deteccion
            </Button>
          </div>
        ) : identities.length ? (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {identities.map((identity) => {
                const selected = selectedIdentityIds.includes(identity.id);
                return (
                  <button
                    key={identity.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={swapRunning}
                    onClick={() =>
                      setSelectedIdentityIds((current) =>
                        current.includes(identity.id)
                          ? current.filter(
                              (identityId) => identityId !== identity.id,
                            )
                          : [...current, identity.id],
                      )
                    }
                    className={`group relative overflow-hidden rounded-lg border bg-white text-left transition dark:bg-[#081216] ${
                      selected
                        ? "border-emerald-500 ring-2 ring-emerald-500/25 dark:bg-emerald-950/25"
                        : "border-zinc-200 hover:border-emerald-400 dark:border-white/10 dark:hover:border-emerald-500/60"
                    }`}
                  >
                    <span
                      className={`absolute left-3 top-3 z-10 grid size-6 place-items-center rounded border shadow-sm ${selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-white/70 bg-zinc-950/55 text-transparent"}`}
                    >
                      <Check size={15} />
                    </span>
                    <img
                      className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      src={identity.thumbnailDataUrl}
                      alt={identity.label}
                    />
                    <span className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <span className="min-w-0">
                        <strong className="block truncate text-sm">
                          {identity.label}
                        </strong>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          Vista en {identity.appearanceCount} muestras
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : analysisJob?.status === "COMPLETED" ? (
          <EmptyIdentityState text="No se detectaron rostros utilizables en este video. Prueba con un video mas nitido o con rostros visibles." />
        ) : (
          <EmptyIdentityState text="Preparando la deteccion automatica de personas." />
        )}
      </Panel>

      <Panel className="border-emerald-200/80 bg-gradient-to-r from-white to-emerald-50/40 dark:border-emerald-500/20 dark:from-[#0b171c] dark:to-emerald-950/20">
        <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <ShieldCheck size={22} />
            </span>
            <div>
              <h2 className="font-semibold">Confirmacion</h2>
              <label className="flex items-start gap-3">
                <input
                  className="mt-1 size-4 w-auto"
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span className="text-sm text-zinc-600 dark:text-zinc-300">
                  Confirmo que tengo derechos o autorizacion sobre los archivos
                  y acepto utilizar esta funcion de forma responsable.
                </span>
              </label>
            </div>
          </div>
          {swapRunning && (
            <div className="lg:col-span-2">
              <JobProgress
                label="Aplicando reemplazo facial"
                progress={faceSwapJob?.progress || 0}
              />
            </div>
          )}
          <Button
            className="min-w-52"
            onClick={run}
            disabled={
              busy ||
              analysisRunning ||
              swapRunning ||
              !image ||
              !video ||
              selectedIdentityIds.length === 0 ||
              !consent
            }
          >
            <Play size={17} />
            {selectedIdentityIds.length > 1
              ? `Reemplazar ${selectedIdentityIds.length} personas`
              : "Iniciar reemplazo"}
          </Button>
        </div>
      </Panel>

      {result ? (
        <MediaPlayer
          title="Video generado"
          asset={result}
          url={assetUrls[result.id]}
          onDownload={downloadAsset}
        />
      ) : (
        <Panel className="overflow-hidden p-0">
          <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-4 dark:border-white/10">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
              <Video size={21} />
            </span>
            <span>
              <strong className="block text-sm">Video generado</strong>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Pendiente
              </span>
            </span>
          </div>
          <div className="m-5 grid min-h-28 place-items-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 py-5 text-center dark:border-white/10 dark:bg-[#081216]">
            <div className="grid justify-items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <FileVideo2 size={27} strokeWidth={1.5} />
              <p className="text-sm">El video generado aparecera aqui.</p>
              <span className="text-xs">
                Inicia el reemplazo para obtener el resultado.
              </span>
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}

function SectionHeading({
  icon,
  title,
  description,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <header
      className={`flex items-center gap-3 ${compact ? "" : "px-5 pb-4 pt-5"}`}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        {icon}
      </span>
      <span className="min-w-0">
        <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </span>
    </header>
  );
}

function formatDuration(seconds: number) {
  if (!seconds) return "Duracion por detectar";
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function EmptyIdentityState({ text }: { text: string }) {
  return (
    <div className="grid min-h-24 place-items-center rounded-lg border border-dashed border-zinc-300 px-5 text-center dark:border-white/10">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{text}</p>
    </div>
  );
}

function sameIdentitySelection(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();
  return normalizedLeft.every(
    (identityId, index) => identityId === normalizedRight[index],
  );
}
