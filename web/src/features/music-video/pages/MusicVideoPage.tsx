import { CheckCircle2, Music, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Panel } from "../../../components/ui/Panel";
import { JobProgress } from "../../../components/ui/JobProgress";
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
import { deriveMusicVideoState } from "../lib/music-video-state";
import { clipStageLabel } from "../lib/scene-labels";

export function MusicVideoPage() {
  const {
    project,
    assetUrls,
    uploadFile,
    createJob,
    downloadAsset,
    retainFastPolling,
  } = useProject();
  const [prompt, setPrompt] = useState(
    "realismo cinematografico con un protagonista y un mundo visual coherentes",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">(
    "success",
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
  }, [createJob, state.analysis, state.storyboardJob]);

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
  }, [audio, createJob, state.clipJob, state.clips, state.composeJob]);

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

  function showMessage(text: string, tone: "success" | "error" = "success") {
    setMessage(text);
    setMessageTone(tone);
  }

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
            <label>
              Direccion visual
              <textarea
                className="min-h-24"
                value={prompt}
                maxLength={500}
                disabled={
                  analysisRunning ||
                  storyboardRunning ||
                  clipRunning ||
                  composeRunning
                }
                onChange={(event) => setPrompt(event.target.value)}
              />
            </label>
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
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {state.analysis.result?.durationSeconds}s de audio ·{" "}
                {Math.round(Number(state.analysis.result?.tempo || 0))} BPM
              </p>
            )}
            <Button
              onClick={preparePlan}
              disabled={
                busy ||
                analysisRunning ||
                storyboardRunning ||
                clipRunning ||
                composeRunning ||
                !audio ||
                !prompt.trim()
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
          </div>
        </Panel>

        <PhaseTwoPanel
          state={state}
          clipRunning={clipRunning}
          composeRunning={composeRunning}
          progress={phaseTwoProgress}
          disabled={
            busy ||
            analysisRunning ||
            storyboardRunning ||
            clipRunning ||
            composeRunning ||
            !state.storyboard ||
            !audio
          }
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
