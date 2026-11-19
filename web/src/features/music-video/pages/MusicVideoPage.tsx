import { CheckCircle2, Music, Play, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { DisabledReason } from "../../../components/ui/DisabledReason";
import { Notice } from "../../../components/ui/Notice";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Panel } from "../../../components/ui/Panel";
import { JobProgress } from "../../../components/ui/JobProgress";
import { TOUR_ANCHORS, tourAnchor } from "../../../tour/anchors";
import { useToast } from "../../../components/ui/Toast";
import { FileUpload } from "../../media/components/FileUpload";
import { AssetSelect } from "../../media/components/AssetSelect";
import { useSelectedAsset } from "../../media/hooks/useSelectedAsset";
import { MUSIC_FILE_ACCEPT } from "../../../shared/media/asset-files";
import { MediaPlayer } from "../../media/components/MediaPlayer";
import { useActiveJobPolling } from "../../jobs/hooks/useActiveJobPolling";
import { getJobFlags } from "../../jobs/hooks/useJobForType";
import { useProject } from "../../projects/context/ProjectContext";
import { PhaseTwoPanel } from "../components/PhaseTwoPanel";
import { SceneList } from "../components/SceneList";
import {
  deriveMusicVideoState,
  getPlanBlockers,
  getProduceBlockers,
} from "../lib/music-video-state";
import { clipStageLabel } from "../lib/scene-labels";

const PROMPT_PRESETS = [
  {
    label: "🎬 Cinemático 8K",
    value:
      "realismo cinematográfico, iluminación volumétrica dramática, alta fidelidad, 8k",
  },
  {
    label: "🌆 Cyberpunk Neón",
    value:
      "estética cyberpunk futurista, luces de neón moradas y cian, lluvia nocturna",
  },
  {
    label: "🎨 Anime Studio",
    value:
      "estilo anime artesanal, colores vibrantes, fondos celestiales detallados",
  },
  {
    label: "🌌 Surrealismo Onírico",
    value:
      "escenas surrealistas y etéreas, gravedad suspendida, atmósfera mágica",
  },
  {
    label: "📼 VHS Retro 90s",
    value:
      "estética retro de los 90s, grano analógico de cinta VHS, colores saturados",
  },
];

export function MusicVideoPage() {
  const {
    project,
    assetUrls,
    uploadFile,
    createJob,
    downloadAsset,
    retainFastPolling,
  } = useProject();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState(
    "realismo cinematografico con un protagonista y un mundo visual coherentes",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">(
    "success",
  );

  const showMessage = useCallback(
    (text: string, tone: "success" | "error" = "success") => {
      setMessage(text);
      setMessageTone(tone);
      if (tone === "success") {
        toast.success(text);
      } else {
        toast.error(text);
      }
    },
    [toast],
  );
  const audios = useMemo(
    () =>
      (project.mediaAssets || []).filter(
        (asset) => asset.kind === "ORIGINAL_AUDIO" && asset.status === "READY",
      ),
    [project.mediaAssets],
  );
  const {
    selectedAsset: audio,
    selectedId: audioId,
    setSelectedId: setAudioId,
  } = useSelectedAsset(audios);
  const state = useMemo(
    () => deriveMusicVideoState(project.jobs, project.mediaAssets, audioId),
    [audioId, project.jobs, project.mediaAssets],
  );
  const { running: analysisRunning, failed: analysisFailed } = getJobFlags(
    state.analysisJob,
  );
  const { running: storyboardRunning, failed: storyboardFailed } = getJobFlags(
    state.storyboardJob,
  );
  const { running: clipRunning, failed: clipFailed } = getJobFlags(
    state.clipJob,
  );
  const { running: composeRunning, failed: composeFailed } = getJobFlags(
    state.composeJob,
  );
  const autoStarted = useRef(new Set<string>());
  const anyJobRunning =
    analysisRunning || storyboardRunning || clipRunning || composeRunning;
  const planBlockers = getPlanBlockers({
    hasAudio: Boolean(audio),
    hasPrompt: Boolean(prompt.trim()),
    busy: busy || anyJobRunning,
  });
  const produceBlockers = getProduceBlockers({
    hasStoryboard: Boolean(state.storyboard),
    hasAudio: Boolean(audio),
    busy: busy || anyJobRunning,
  });

  useActiveJobPolling(
    retainFastPolling,
    analysisRunning || storyboardRunning || clipRunning || composeRunning,
  );

  useEffect(() => {
    const analysis = state.analysis;
    if (
      !analysis ||
      !analysis.payload?.autoCreateStoryboard ||
      state.storyboardJob
    )
      return;
    const key = `storyboard:${analysis.id}`;
    if (autoStarted.current.has(key)) return;
    autoStarted.current.add(key);
    createJob("GENERATE_STORYBOARD", {
      analysisJobId: analysis.id,
      visualPrompt: analysis.payload.visualPrompt,
      automaticPipeline: true,
    })
      .then(() => showMessage("Creando el plan de escenas..."))
      .catch((error) => showMessage((error as Error).message, "error"));
  }, [createJob, showMessage, state.analysis, state.storyboardJob]);

  useEffect(() => {
    const clipJob = state.clipJob;
    if (
      clipJob?.status !== "COMPLETED" ||
      !clipJob.payload?.autoCompose ||
      !audio ||
      !state.clips.length ||
      state.composeJob
    )
      return;
    const key = `compose:${clipJob.id}`;
    if (autoStarted.current.has(key)) return;
    autoStarted.current.add(key);
    createJob("COMPOSE_VIDEOCLIP", {
      audioAssetId: audio.id,
      clipAssetIds: state.clips.map((asset) => asset.id),
      clipJobId: clipJob.id,
      automaticPipeline: true,
    })
      .then(() => showMessage("Componiendo el videoclip final..."))
      .catch((error) => showMessage((error as Error).message, "error"));
  }, [
    audio,
    createJob,
    showMessage,
    state.clipJob,
    state.clips,
    state.composeJob,
  ]);

  useEffect(() => {
    if (
      !message ||
      analysisRunning ||
      storyboardRunning ||
      clipRunning ||
      composeRunning
    )
      return;
    const timeout = window.setTimeout(
      () => setMessage(""),
      messageTone === "error" ? 7000 : 4000,
    );
    return () => window.clearTimeout(timeout);
  }, [
    analysisRunning,
    clipRunning,
    composeRunning,
    message,
    messageTone,
    storyboardRunning,
  ]);

  async function upload(file: File) {
    try {
      const asset = await uploadFile(file, file.name, "ORIGINAL_AUDIO");
      setAudioId(asset.id);
      showMessage("Audio subido.");
    } catch (error) {
      showMessage((error as Error).message, "error");
    }
  }
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      showMessage(success);
    } catch (error) {
      showMessage((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  const preparePlan = () => {
    if (!audio) return showMessage("Sube primero una pieza musical.", "error");
    if (!prompt.trim())
      return showMessage("Escribe una direccion visual.", "error");
    return run(
      () =>
        createJob("ANALYZE_AUDIO", {
          audioAssetId: audio.id,
          visualPrompt: prompt.trim(),
          autoCreateStoryboard: true,
        }),
      "Analizando la musica...",
    );
  };

  const produceVideo = () => {
    if (!state.storyboard || !audio)
      return showMessage("Primero crea y revisa el plan de escenas.", "error");
    return run(
      () =>
        createJob("GENERATE_VIDEO_CLIPS", {
          storyboardJobId: state.storyboard!.id,
          audioAssetId: audio.id,
          style: "cinematic",
          autoCompose: true,
        }),
      "Generando los clips del videoclip...",
    );
  };

  const activeMessage = analysisRunning
    ? `${state.analysisJob?.result?.stage === "vocal_isolation" ? "Aislando voz" : state.analysisJob?.result?.stage === "transcription" ? "Transcribiendo letra" : "Analizando musica"}... ${state.analysisJob?.progress || 0}%`
    : storyboardRunning
      ? `Creando plan de escenas... ${state.storyboardJob?.progress || 0}%`
      : clipRunning
        ? `${clipStageLabel(
            state.clipJob?.result?.stage,
            state.clipJob?.result?.sceneIndex,
            state.clipJob?.result?.sceneCount,
          )}... ${state.clipJob?.progress || 0}%`
        : composeRunning
          ? `Componiendo videoclip final... ${state.composeJob?.progress || 0}%`
          : "";
  const failedMessage = analysisFailed
    ? state.analysisJob?.errorMessage || "El analisis no pudo completarse."
    : storyboardFailed
      ? state.storyboardJob?.errorMessage ||
        "No se pudo crear el plan de escenas."
      : clipFailed
        ? state.clipJob?.errorMessage || "Los clips no pudieron generarse."
        : composeFailed
          ? state.composeJob?.errorMessage ||
            "No se pudo componer el videoclip."
          : "";

  const phaseOneProgress = state.storyboard
    ? 100
    : storyboardRunning
      ? 70 + Math.round((state.storyboardJob?.progress || 0) * 0.3)
      : state.analysis
        ? 70
        : Math.round((state.analysisJob?.progress || 0) * 0.7);
  const phaseTwoProgress = state.finalVideo
    ? 100
    : composeRunning
      ? 90 + Math.round((state.composeJob?.progress || 0) * 0.1)
      : state.clipJob?.status === "COMPLETED"
        ? 90
        : Math.round((state.clipJob?.progress || 0) * 0.9);

  return (
    <>
      <PageHeader
        title="Video desde musica"
        description={project.name}
        actions={
          <FileUpload
            accept={MUSIC_FILE_ACCEPT}
            label="Subir musica"
            anchor={TOUR_ANCHORS.musicUpload}
            busy={busy}
            onSelect={upload}
          />
        }
      />
      <Notice
        message={activeMessage || failedMessage || message}
        tone={failedMessage ? "error" : activeMessage ? "info" : messageTone}
      />
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel className="border-emerald-200/80 dark:border-emerald-500/25">
          <div className="mb-5 flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              {state.storyboard ? (
                <CheckCircle2 size={24} />
              ) : (
                <Music size={24} />
              )}
            </span>
            <div>
              <span className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400">
                Fase 1
              </span>
              <h2 className="font-semibold">Analizar y crear el plan</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Analiza la musica y prepara las escenas para que puedas
                revisarlas.
              </p>
            </div>
          </div>
          <div className="grid gap-4">
            {audios.length === 0 ? (
              <FileUpload
                mode="dropzone"
                anchor={TOUR_ANCHORS.musicDropzone}
                accept={MUSIC_FILE_ACCEPT}
                label="Arrastra tu pista musical aqui"
                description="Formatos MP3, WAV o FLAC"
                busy={busy}
                onSelect={upload}
              />
            ) : (
              <AssetSelect
                label="Musica del proyecto"
                assets={audios}
                value={audioId}
                onChange={setAudioId}
                disabled={
                  busy ||
                  analysisRunning ||
                  storyboardRunning ||
                  clipRunning ||
                  composeRunning
                }
              />
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-500" />
                  Dirección visual del videoclip
                </label>
                <span className="text-[11px] font-mono text-zinc-400">
                  {prompt.length}/500
                </span>
              </div>
              <textarea
                className="w-full min-h-24 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs sm:text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-white/10 dark:bg-[#071216] dark:text-white"
                {...tourAnchor(TOUR_ANCHORS.musicPrompt)}
                value={prompt}
                maxLength={500}
                placeholder="Describe la atmósfera, iluminación y estética deseada..."
                disabled={
                  analysisRunning ||
                  storyboardRunning ||
                  clipRunning ||
                  composeRunning
                }
                onChange={(event) => setPrompt(event.target.value)}
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-medium text-zinc-400 mr-1">
                  Estilos sugeridos:
                </span>
                {PROMPT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setPrompt(preset.value)}
                    disabled={
                      analysisRunning ||
                      storyboardRunning ||
                      clipRunning ||
                      composeRunning
                    }
                    className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-zinc-700 shadow-xs transition hover:border-emerald-500/50 hover:bg-emerald-50/50 hover:text-emerald-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            {(state.analysisJob || state.storyboardJob) && (
              <JobProgress
                label={
                  state.storyboard
                    ? "Plan listo para revisar"
                    : storyboardRunning
                      ? "Creando plan de escenas"
                      : analysisRunning
                        ? "Analizando musica y letra"
                        : "Preparando plan"
                }
                progress={phaseOneProgress}
              />
            )}
            {state.analysis && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-zinc-700 dark:text-zinc-300">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                  BPM
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    Análisis rítmico:{" "}
                    {Math.round(Number(state.analysis.result?.tempo || 0))} BPM
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Duración: {state.analysis.result?.durationSeconds} segundos
                  </p>
                </div>
              </div>
            )}
            <Button
              onClick={preparePlan}
              {...tourAnchor(TOUR_ANCHORS.musicPlan)}
              disabled={planBlockers.length > 0}
              aria-describedby={
                planBlockers.length ? "plan-blockers" : undefined
              }
            >
              <Play size={17} />
              {analysisRunning
                ? `Analizando ${state.analysisJob?.progress || 0}%`
                : storyboardRunning
                  ? "Creando plan..."
                  : state.storyboard
                    ? "Crear un nuevo plan"
                    : "Analizar y crear plan"}
            </Button>
            <DisabledReason id="plan-blockers" reasons={planBlockers} />
          </div>
        </Panel>

        <PhaseTwoPanel
          state={state}
          clipRunning={clipRunning}
          composeRunning={composeRunning}
          progress={phaseTwoProgress}
          blockers={produceBlockers}
          onProduce={produceVideo}
        />
      </section>
      {state.scenes.length > 0 && (
        <SceneList
          scenes={state.scenes}
          bpm={Math.round(Number(state.analysis?.result?.tempo || 0))}
        />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {state.clips.map((clip) => (
          <MediaPlayer
            key={clip.id}
            title="Clip generado"
            asset={clip}
            url={assetUrls[clip.id]}
            onDownload={downloadAsset}
          />
        ))}
        <MediaPlayer
          title="Videoclip final"
          asset={state.finalVideo}
          url={state.finalVideo && assetUrls[state.finalVideo.id]}
          onDownload={downloadAsset}
        />
      </div>
    </>
  );
}
