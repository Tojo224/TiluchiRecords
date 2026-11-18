import {
  ArrowRight,
  Check,
  Loader2,
  RefreshCw,
  ScanFace,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useToast } from "../../../components/ui/Toast";
import { Button } from "../../../components/ui/Button";
import { JobProgress } from "../../../components/ui/JobProgress";
import { Notice } from "../../../components/ui/Notice";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Panel } from "../../../components/ui/Panel";
import { MediaPlayer } from "../../media/components/MediaPlayer";
import { useSelectedAsset } from "../../media/hooks/useSelectedAsset";
import { useActiveJobPolling } from "../../jobs/hooks/useActiveJobPolling";
import { useJobForType } from "../../jobs/hooks/useJobForType";
import { useProject } from "../../projects/context/ProjectContext";
import { ConsentPanel } from "../components/ConsentPanel";
import { EmptyIdentityState } from "../components/EmptyIdentityState";
import { GeneratedVideoPlaceholder } from "../components/GeneratedVideoPlaceholder";
import { IdentityGrid } from "../components/IdentityGrid";
import { SectionHeading } from "../components/SectionHeading";
import { SourceImagePanel } from "../components/SourceImagePanel";
import { TargetVideoPanel } from "../components/TargetVideoPanel";
import {
  getFaceSwapBlockers,
  sameIdentitySelection,
  type FaceIdentity,
} from "../lib/face-swap-state";

export function FaceSwapPage() {
  const { api } = useAuth();
  const { toast } = useToast();
  const {
    project,
    assetUrls,
    uploadFile,
    createJob,
    downloadAsset,
    retainFastPolling,
  } = useProject();
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

  const { job: analysisJob, running: analysisRunning } = useJobForType(
    project.jobs,
    "ANALYZE_VIDEO_FACES",
    (job) => job.payload?.sourceVideoAssetId === videoId,
  );
  const identities = (
    analysisJob?.status === "COMPLETED" &&
    Array.isArray(analysisJob.result?.identities)
      ? analysisJob.result.identities
      : []
  ) as FaceIdentity[];

  const { job: faceSwapJob, running: swapRunning } = useJobForType(
    project.jobs,
    "FACE_SWAP",
    (job) => {
      const jobIdentityIds = Array.isArray(job.payload?.targetIdentityIds)
        ? job.payload.targetIdentityIds
        : job.payload?.targetIdentityId
          ? [job.payload.targetIdentityId]
          : [];
      return (
        job.payload?.sourceImageAssetId === imageId &&
        job.payload?.sourceVideoAssetId === videoId &&
        sameIdentitySelection(jobIdentityIds, selectedIdentityIds)
      );
    },
  );
  const result = (project.mediaAssets || []).find(
    (asset) =>
      asset.kind === "FACE_SWAP_RESULT_VIDEO" &&
      asset.status === "READY" &&
      asset.metadata?.sourceJobId === faceSwapJob?.id,
  );

  const blockers = getFaceSwapBlockers({
    hasImage: Boolean(image),
    hasVideo: Boolean(video),
    busy,
    analysisRunning,
    swapRunning,
    identityCount: identities.length,
    selectedCount: selectedIdentityIds.length,
    consent,
  });

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

  useActiveJobPolling(retainFastPolling, analysisRunning || swapRunning);

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
    if (tone === "success") {
      toast.success(value);
    } else {
      toast.error(value);
    }
  }

  return (
    <>
      <PageHeader title="Face swap" description={project.name} />
      <Notice message={message} tone={messageTone} />

      {/* Pipeline Stepper */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          {
            step: 1,
            title: "Rostro Fuente",
            desc: image ? image.name : "Pendiente",
            done: Boolean(image),
            active: !image,
          },
          {
            step: 2,
            title: "Video Objetivo",
            desc: video ? video.name : "Pendiente",
            done: Boolean(video),
            active: Boolean(image) && !video,
          },
          {
            step: 3,
            title: "Detección Facial",
            desc: selectedIdentityIds.length
              ? `${selectedIdentityIds.length} selec.`
              : analysisRunning
                ? "Analizando..."
                : "Pendiente",
            done: selectedIdentityIds.length > 0,
            active: Boolean(video) && selectedIdentityIds.length === 0,
          },
          {
            step: 4,
            title: "Swap & Render",
            desc: swapRunning
              ? "Procesando..."
              : result
                ? "Completado"
                : "Listo",
            done: Boolean(result),
            active: selectedIdentityIds.length > 0 && !result,
          },
        ].map((item) => (
          <div
            key={item.step}
            className={`flex items-center gap-2.5 rounded-xl border p-3 transition-all ${
              item.done
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                : item.active
                  ? "border-emerald-500 bg-white shadow-sm ring-2 ring-emerald-500/20 dark:bg-[#0b171c]"
                  : "border-zinc-200 bg-zinc-50/60 text-zinc-400 dark:border-white/5 dark:bg-[#061014]"
            }`}
          >
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                item.done
                  ? "bg-emerald-500 text-white"
                  : item.active
                    ? "bg-emerald-600 text-white animate-pulse"
                    : "bg-zinc-200 text-zinc-600 dark:bg-white/10 dark:text-zinc-400"
              }`}
            >
              {item.done ? <Check size={14} /> : item.step}
            </span>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold">
                {item.title}
              </span>
              <span className="block truncate text-[11px] opacity-75">
                {item.desc}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Dual Comparison Preview Card */}
      {image && video && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 via-cyan-500/5 to-emerald-500/5 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-emerald-500/40 bg-black">
              {assetUrls[image.id] ? (
                <img
                  src={assetUrls[image.id]}
                  alt="Rostro"
                  className="size-full object-cover"
                />
              ) : (
                <Loader2 className="m-auto size-5 animate-spin text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Rostro Fuente Seleccionado
              </span>
              <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-white">
                {image.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <ScanFace className="size-5 text-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Swap hacia</span>
            <ArrowRight className="size-4" />
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right min-w-0">
              <span className="block text-xs font-medium text-cyan-600 dark:text-cyan-400">
                Video Objetivo
              </span>
              <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-white">
                {video.name}
              </span>
            </div>
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-500">
              <Video className="size-6" />
            </div>
          </div>
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        <SourceImagePanel
          images={images}
          image={image}
          imageId={imageId}
          assetUrls={assetUrls}
          disabled={busy || swapRunning}
          onImageChange={setImageId}
          onUpload={uploadImage}
        />

        <TargetVideoPanel
          videos={videos}
          video={video}
          videoId={videoId}
          assetUrls={assetUrls}
          disabled={busy || analysisRunning || swapRunning}
          onVideoChange={setVideoId}
          onUpload={uploadVideo}
        />
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
          <IdentityGrid
            identities={identities}
            selectedIdentityIds={selectedIdentityIds}
            disabled={swapRunning}
            onSelectionChange={setSelectedIdentityIds}
          />
        ) : analysisJob?.status === "COMPLETED" ? (
          <EmptyIdentityState text="No se detectaron rostros utilizables en este video. Prueba con un video mas nitido o con rostros visibles." />
        ) : (
          <EmptyIdentityState text="Preparando la deteccion automatica de personas." />
        )}
      </Panel>

      <ConsentPanel
        consent={consent}
        swapRunning={swapRunning}
        swapProgress={faceSwapJob?.progress || 0}
        selectedCount={selectedIdentityIds.length}
        blockers={blockers}
        onConsentChange={setConsent}
        onRun={run}
      />

      {result ? (
        <MediaPlayer
          title="Video generado"
          asset={result}
          url={assetUrls[result.id]}
          onDownload={downloadAsset}
        />
      ) : (
        <GeneratedVideoPlaceholder />
      )}
    </>
  );
}
