import { CheckCircle2, Film, Music, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Panel } from "../../../components/ui/Panel";
import { JobProgress } from "../../../components/ui/JobProgress";
import type { StoryboardScene } from "../../../shared/types/domain";
import { FileUpload } from "../../media/components/FileUpload";
import { AssetSelect } from "../../media/components/AssetSelect";
import { useSelectedAsset } from "../../media/hooks/useSelectedAsset";
import { MUSIC_FILE_ACCEPT } from "../../../shared/media/asset-files";
import { MediaPlayer } from "../../media/components/MediaPlayer";
import { useProject } from "../../projects/context/ProjectContext";

export function MusicVideoPage() {
  const { project, assetUrls, uploadFile, createJob, downloadAsset, refresh } =
    useProject();
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
  const state = useMemo(() => {
    const jobs = project.jobs || [];
    const analysisJob = jobs.find(
      (job) =>
        job.type === "ANALYZE_AUDIO" && job.payload?.audioAssetId === audioId,
    );
    const analysis =
      analysisJob?.status === "COMPLETED" ? analysisJob : undefined;
    const storyboardJob = jobs.find(
      (job) =>
        job.type === "GENERATE_STORYBOARD" &&
        job.payload?.analysisJobId === analysis?.id,
    );
    const storyboard =
      storyboardJob?.status === "COMPLETED" &&
      storyboardJob.result?.schemaVersion === "music-video-v2"
        ? storyboardJob
        : undefined;
    const clipJob = jobs.find(
      (job) =>
        job.type === "GENERATE_VIDEO_CLIPS" &&
        job.payload?.storyboardJobId === storyboard?.id,
    );
    const completedClipJob =
      clipJob?.status === "COMPLETED" ? clipJob : undefined;
    const clips = (project.mediaAssets || []).filter(
      (asset) =>
        asset.kind === "VIDEO_CLIP" &&
        asset.status === "READY" &&
        asset.metadata?.sourceJobId === completedClipJob?.id,
    );
    const composeJob = jobs.find(
      (job) =>
        job.type === "COMPOSE_VIDEOCLIP" &&
        job.payload?.audioAssetId === audioId &&
        (job.payload?.clipJobId === completedClipJob?.id ||
          (clips.length > 0 &&
            clips.every((clip) =>
              job.payload?.clipAssetIds?.includes(clip.id),
            ))),
    );
    const finalVideo = (project.mediaAssets || []).find(
      (asset) =>
        asset.kind === "FINAL_VIDEOCLIP" &&
        asset.status === "READY" &&
        asset.metadata?.sourceJobId === composeJob?.id,
    );
    return {
      analysis,
      analysisJob,
      storyboard,
      storyboardJob,
      clipJob,
      composeJob,
      clips,
      finalVideo,
      scenes: (Array.isArray(storyboard?.result?.scenes)
        ? storyboard.result.scenes
        : []) as StoryboardScene[],
    };
  }, [audioId, project.jobs, project.mediaAssets]);
  const analysisRunning =
    state.analysisJob?.status === "PENDING" ||
    state.analysisJob?.status === "PROCESSING";
  const analysisFailed = state.analysisJob?.status === "FAILED";
  const storyboardRunning =
    state.storyboardJob?.status === "PENDING" ||
    state.storyboardJob?.status === "PROCESSING";
  const storyboardFailed = state.storyboardJob?.status === "FAILED";
  const clipRunning =
    state.clipJob?.status === "PENDING" ||
    state.clipJob?.status === "PROCESSING";
  const clipFailed = state.clipJob?.status === "FAILED";
  const composeRunning =
    state.composeJob?.status === "PENDING" ||
    state.composeJob?.status === "PROCESSING";
  const composeFailed = state.composeJob?.status === "FAILED";
  const autoStarted = useRef(new Set<string>());

  useEffect(() => {
    if (
      !analysisRunning &&
      !storyboardRunning &&
      !clipRunning &&
      !composeRunning
    )
      return;
    const interval = window.setInterval(
      () => refresh().catch(() => undefined),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [
    analysisRunning,
    clipRunning,
    composeRunning,
    refresh,
    storyboardRunning,
  ]);

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

        <Panel className="border-cyan-200/80 dark:border-cyan-500/25">
          <div className="mb-5 flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
              {state.finalVideo ? (
                <CheckCircle2 size={24} />
              ) : (
                <Film size={24} />
              )}
            </span>
            <div>
              <span className="text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-400">
                Fase 2
              </span>
              <h2 className="font-semibold">Generar y componer el videoclip</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Genera los clips del plan aprobado y los une con la musica.
              </p>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-[#081216]">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Plan
                </span>
                <strong className="mt-1 block text-sm">
                  {state.storyboard
                    ? `${state.scenes.length} escenas listas`
                    : "Pendiente de revision"}
                </strong>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-[#081216]">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Resultado
                </span>
                <strong className="mt-1 block truncate text-sm">
                  {state.finalVideo?.name ||
                    `${state.clips.length} clips generados`}
                </strong>
              </div>
            </div>
            {(state.clipJob || state.composeJob) && (
              <JobProgress
                label={
                  state.finalVideo
                    ? "Videoclip terminado"
                    : composeRunning
                      ? "Componiendo video y musica"
                      : clipRunning
                        ? clipStageLabel(
                            state.clipJob?.result?.stage,
                            state.clipJob?.result?.sceneIndex,
                            state.clipJob?.result?.sceneCount,
                          )
                        : "Preparando composicion"
                }
                progress={phaseTwoProgress}
              />
            )}
            <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
              {state.storyboard
                ? "Revisa el plan de escenas de abajo. Cuando estes conforme, inicia la produccion."
                : "Esta fase se habilitara cuando el plan de escenas este listo."}
            </div>
            <Button
              onClick={produceVideo}
              disabled={
                busy ||
                analysisRunning ||
                storyboardRunning ||
                clipRunning ||
                composeRunning ||
                !state.storyboard ||
                !audio
              }
            >
              <Film size={17} />
              {clipRunning
                ? `Generando clips ${state.clipJob?.progress || 0}%`
                : composeRunning
                  ? `Componiendo ${state.composeJob?.progress || 0}%`
                  : state.finalVideo
                    ? "Generar nuevamente"
                    : "Generar videoclip"}
            </Button>
          </div>
        </Panel>
      </section>
      {state.scenes.length > 0 && (
        <Panel title="Plan de escenas">
          <div className="grid gap-3">
            {state.scenes.map((scene, index) => (
              <article
                key={`${scene.sceneIndex}-${scene.startTime}`}
                className="grid grid-cols-[3rem_1fr] gap-4 border-b border-zinc-200 pb-4 last:border-0 dark:border-zinc-800"
              >
                <b className="grid size-12 place-items-center bg-emerald-700 text-white">
                  {scene.sceneIndex}
                </b>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <strong className="text-sm text-zinc-950 dark:text-zinc-50">
                      {scene.title || scenePhase(index, state.scenes.length)}
                    </strong>
                    <span className="text-xs font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatTimelineTime(scene.startTime)} -{" "}
                      {formatTimelineTime(scene.endTime)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {friendlySceneDescription(
                      scene,
                      index,
                      state.scenes.length,
                    )}
                  </p>
                  {scene.lyrics && (
                    <blockquote className="mt-2 border-l-2 border-emerald-600 pl-3 text-sm italic text-zinc-700 dark:text-zinc-300">
                      {scene.lyrics}
                    </blockquote>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                    {scene.shotType && (
                      <span className="border border-zinc-200 px-2 py-1 dark:border-zinc-700">
                        {shotTypeLabel(scene.shotType)}
                      </span>
                    )}
                    {scene.locationDescription && (
                      <span className="border border-zinc-200 px-2 py-1 dark:border-zinc-700">
                        {scene.locationDescription}
                      </span>
                    )}
                    {scene.lipSync && (
                      <span className="border border-emerald-600 px-2 py-1 text-emerald-700 dark:text-emerald-400">
                        Canto sincronizado
                      </span>
                    )}
                    {scene.reusePolicy === "DIRECT" &&
                      scene.sourceSceneIndex && (
                        <span className="border border-sky-600 px-2 py-1 text-sky-700 dark:text-sky-400">
                          Reutiliza escena {scene.sourceSceneIndex}
                        </span>
                      )}
                    {scene.reusePolicy === "VARIANT" &&
                      scene.sourceSceneIndex && (
                        <span className="border border-amber-600 px-2 py-1 text-amber-700 dark:text-amber-400">
                          Variante de escena {scene.sourceSceneIndex}
                        </span>
                      )}
                    <span className="border border-zinc-200 px-2 py-1 tabular-nums dark:border-zinc-700">
                      Duracion: {Math.round(scene.endTime - scene.startTime)} s
                    </span>
                    <span className="border border-zinc-200 px-2 py-1 dark:border-zinc-700">
                      {intensityLabel(scene, index, state.scenes.length)}
                    </span>
                    <span className="border border-zinc-200 px-2 py-1 tabular-nums dark:border-zinc-700">
                      Ritmo:{" "}
                      {Math.round(Number(state.analysis?.result?.tempo || 0))}{" "}
                      BPM
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Panel>
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

function scenePhase(index: number, total: number) {
  if (index === 0) return "Apertura";
  if (index === total - 1) return "Cierre";
  if (total > 2 && index === total - 2) return "Punto alto";
  return "Desarrollo";
}

function formatTimelineTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function friendlySceneDescription(
  scene: StoryboardScene,
  index: number,
  total: number,
) {
  if (scene.title) return scene.description;

  const visualIdea = scene.description.split(/\. Escena \d+/i)[0].trim();
  const phase = scenePhase(index, total);
  const action =
    phase === "Apertura"
      ? "Presenta el ambiente y la idea principal"
      : phase === "Desarrollo"
        ? "Desarrolla la idea con nuevos encuadres y movimiento"
        : phase === "Punto alto"
          ? "Aumenta la energia visual y acelera los cambios"
          : "Cierra la secuencia y resuelve la idea visual";
  return `${action}. Concepto: ${visualIdea}.`;
}

function intensityLabel(scene: StoryboardScene, index: number, total: number) {
  if (scene.intensity) return `Intensidad: ${scene.intensity}`;
  const phase = scenePhase(index, total);
  if (phase === "Apertura") return "Intensidad: suave";
  if (phase === "Punto alto") return "Intensidad: alta";
  if (phase === "Cierre") return "Intensidad: final";
  return "Intensidad: media";
}

function shotTypeLabel(value: NonNullable<StoryboardScene["shotType"]>) {
  if (value === "PERFORMANCE") return "Interpretacion";
  if (value === "ESTABLISHING") return "Ambiente";
  return "Narrativa";
}

function clipStageLabel(
  stage?: string,
  sceneIndex?: number,
  sceneCount?: number,
) {
  const scene =
    sceneIndex && sceneCount ? ` - escena ${sceneIndex} de ${sceneCount}` : "";
  if (stage === "keyframes") return `Creando escenas y fondos${scene}`;
  if (stage === "animation") return `Generando movimiento${scene}`;
  if (stage === "identity_and_lips")
    return `Sincronizando rostro y canto${scene}`;
  if (stage === "encoding") return "Codificando clips";
  return "Preparando videoclip";
}
