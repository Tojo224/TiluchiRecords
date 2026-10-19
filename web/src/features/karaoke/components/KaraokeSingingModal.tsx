import {
  AlertTriangle,
  Loader2,
  Mic2,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { makeRecordingSeekable } from "../../../shared/media/seekable-recording";

type Phase =
  | "ready"
  | "preparing"
  | "recording"
  | "naming"
  | "saving"
  | "error";

type CapturableVideo = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

export function KaraokeSingingModal({
  videoUrl,
  defaultName,
  onClose,
  onSave,
}: {
  videoUrl: string;
  defaultName: string;
  onClose: () => void;
  onSave: (
    recording: Blob,
    name: string,
    durationSeconds: number,
  ) => Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const capturedVideoRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const recordingStartedAtRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [recording, setRecording] = useState<Blob | null>(null);
  const [pieceName, setPieceName] = useState(defaultName);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      discardRef.current = true;
      sessionActiveRef.current = false;
      releaseMedia();
    };
  }, []);

  useEffect(() => {
    if (phase !== "recording") return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [phase]);

  function releaseMedia() {
    microphoneRef.current?.getTracks().forEach((track) => track.stop());
    capturedVideoRef.current?.getTracks().forEach((track) => track.stop());
    microphoneRef.current = null;
    capturedVideoRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") void context.close();
  }

  function stopRecording() {
    if (!sessionActiveRef.current) return;
    sessionActiveRef.current = false;
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  }

  async function startSinging() {
    const video = videoRef.current as CapturableVideo | null;
    if (!video) return;
    setPhase("preparing");
    setError("");
    discardRef.current = false;
    chunksRef.current = [];

    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error(
          "Este navegador no permite grabar el microfono y el video. Usa una version reciente de Chrome o Edge.",
        );
      }
      const capture = video.captureStream || video.mozCaptureStream;
      if (!capture) {
        throw new Error(
          "Tu navegador no permite capturar la reproduccion del karaoke. Usa Chrome o Edge.",
        );
      }

      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2,
        },
        video: false,
      });
      microphoneRef.current = microphone;

      video.currentTime = 0;
      const capturedVideo = capture.call(video);
      capturedVideoRef.current = capturedVideo;
      const videoTrack = capturedVideo.getVideoTracks()[0];
      const karaokeAudioTracks = capturedVideo.getAudioTracks();
      if (!videoTrack || karaokeAudioTracks.length === 0) {
        throw new Error(
          "No se pudo capturar el video karaoke con su audio instrumental.",
        );
      }

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      await audioContext.resume();
      const output = audioContext.createMediaStreamDestination();
      audioContext
        .createMediaStreamSource(new MediaStream(karaokeAudioTracks))
        .connect(output);
      audioContext.createMediaStreamSource(microphone).connect(output);

      const combinedStream = new MediaStream([
        videoTrack,
        ...output.stream.getAudioTracks(),
      ]);
      const mimeType = preferredRecordingMimeType();
      const recorder = new MediaRecorder(combinedStream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 6_000_000,
        audioBitsPerSecond: 192_000,
      });
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        sessionActiveRef.current = false;
        releaseMedia();
        setError("La grabacion se interrumpio y no se guardo ningun archivo.");
        setPhase("error");
      };
      recorder.onstop = async () => {
        releaseMedia();
        if (discardRef.current) return;
        const recordedSeconds = Math.max(
          0.1,
          (performance.now() - recordingStartedAtRef.current) / 1000,
        );
        const rawBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "video/webm",
        });
        if (!rawBlob.size) {
          setError("La grabacion termino sin datos y no puede guardarse.");
          setPhase("error");
          return;
        }
        try {
          const seekableBlob = await makeRecordingSeekable(
            rawBlob,
            recordedSeconds,
          );
          setRecording(seekableBlob);
          setElapsed(recordedSeconds);
          setDuration(recordedSeconds);
          setPhase("naming");
        } catch {
          setError(
            "No se pudo preparar la duracion del video. La interpretacion no se guardo.",
          );
          setPhase("error");
        }
      };

      recorder.start(1000);
      recordingStartedAtRef.current = performance.now();
      sessionActiveRef.current = true;
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setPhase("recording");
      await video.play();
    } catch (caught) {
      discardRef.current = true;
      sessionActiveRef.current = false;
      const recorder = recorderRef.current;
      if (recorder?.state === "recording") recorder.stop();
      releaseMedia();
      const message = (caught as Error).message;
      setError(
        message.includes("Permission") || message.includes("denied")
          ? "Debes permitir el acceso al microfono para iniciar el karaoke."
          : message,
      );
      setPhase("error");
    }
  }

  function close() {
    if (phase === "saving") return;
    if (
      (phase === "recording" || phase === "naming") &&
      !window.confirm(
        "Si sales ahora, esta interpretacion no se guardara. Salir?",
      )
    ) {
      return;
    }
    discardRef.current = true;
    sessionActiveRef.current = false;
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    videoRef.current?.pause();
    releaseMedia();
    onClose();
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const name = pieceName.trim();
    if (!recording || !name) return;
    setPhase("saving");
    setError("");
    try {
      await onSave(recording, name, duration || elapsed);
      onClose();
    } catch (caught) {
      setError(
        (caught as Error).message || "No se pudo guardar la interpretacion.",
      );
      setPhase("naming");
    }
  }

  const progress = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-zinc-950/85 p-2 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="karaoke-session-title"
    >
      <section className="flex h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-white/15 bg-white shadow-2xl dark:bg-[#071217]">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 dark:border-white/10 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Mic2 size={21} />
            </span>
            <div className="min-w-0">
              <h2 id="karaoke-session-title" className="truncate font-semibold">
                Cantar karaoke
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {phase === "recording"
                  ? "Grabando interpretacion"
                  : phase === "naming" || phase === "saving"
                    ? "Interpretacion finalizada"
                    : "Prepara tu microfono"}
              </p>
            </div>
          </div>
          <Button
            variant="icon"
            className="shrink-0"
            aria-label="Salir del karaoke"
            title={phase === "saving" ? "Guardando interpretacion" : "Salir"}
            disabled={phase === "saving"}
            onClick={close}
          >
            <X size={19} />
          </Button>
        </header>

        <div className="relative min-h-0 flex-1 overflow-auto bg-zinc-950">
          <video
            ref={videoRef}
            className="mx-auto aspect-video max-h-[72vh] w-full bg-black object-contain"
            src={videoUrl}
            crossOrigin="anonymous"
            playsInline
            preload="auto"
            disablePictureInPicture
            controls={false}
            onLoadedMetadata={(event) =>
              setDuration(event.currentTarget.duration || 0)
            }
            onTimeUpdate={(event) =>
              setElapsed(event.currentTarget.currentTime)
            }
            onEnded={stopRecording}
            onPause={(event) => {
              if (sessionActiveRef.current && !event.currentTarget.ended) {
                void event.currentTarget.play();
              }
            }}
            onContextMenu={(event) => event.preventDefault()}
          />

          {(phase === "ready" ||
            phase === "preparing" ||
            phase === "error") && (
            <div className="absolute inset-0 grid place-items-center bg-zinc-950/80 p-6 text-white">
              <div className="max-w-lg text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
                  {phase === "preparing" ? (
                    <Loader2 className="animate-spin" size={30} />
                  ) : phase === "error" ? (
                    <AlertTriangle size={30} />
                  ) : (
                    <Mic2 size={30} />
                  )}
                </span>
                <h3 className="mt-5 text-xl font-semibold">
                  {phase === "error"
                    ? "No se pudo iniciar"
                    : "Listo para cantar?"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  {error ||
                    "Al comenzar, el video y la grabacion no se podran pausar. Usa audifonos para evitar eco y canta siguiendo la letra."}
                </p>
                <Button
                  className="mt-6 min-w-52"
                  disabled={phase === "preparing"}
                  onClick={startSinging}
                >
                  {phase === "preparing" ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Mic2 size={18} />
                  )}
                  {phase === "error"
                    ? "Intentar nuevamente"
                    : "Comenzar a cantar"}
                </Button>
              </div>
            </div>
          )}

          {(phase === "naming" || phase === "saving") && (
            <div className="absolute inset-0 grid place-items-center bg-zinc-950/85 p-5">
              <form
                className="w-full max-w-md rounded-lg border border-white/15 bg-white p-5 text-zinc-950 shadow-2xl dark:bg-[#0b171c] dark:text-white sm:p-6"
                onSubmit={save}
              >
                <span className="grid size-12 place-items-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <ShieldCheck size={25} />
                </span>
                <h3 className="mt-4 text-xl font-semibold">
                  Asignar nombre a la pieza
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  La voz y el video karaoke se guardaran juntos en Resultados.
                </p>
                <label
                  className="mt-5 block text-sm font-medium"
                  htmlFor="karaoke-piece-name"
                >
                  Nombre
                </label>
                <input
                  id="karaoke-piece-name"
                  autoFocus
                  maxLength={120}
                  value={pieceName}
                  disabled={phase === "saving"}
                  onChange={(event) => setPieceName(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/15 dark:bg-zinc-950"
                  placeholder="Ej. Mi primera interpretacion"
                />
                {error && (
                  <p className="mt-3 text-sm text-red-600 dark:text-red-300">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="mt-5 w-full"
                  disabled={phase === "saving" || !pieceName.trim()}
                >
                  {phase === "saving" ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Save size={18} />
                  )}
                  {phase === "saving"
                    ? "Guardando..."
                    : "Guardar interpretacion"}
                </Button>
              </form>
            </div>
          )}
        </div>

        {phase === "recording" && (
          <footer className="shrink-0 border-t border-zinc-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#0b171c] sm:px-5">
            <div className="mb-2 flex items-center justify-between gap-4 text-sm">
              <span className="flex items-center gap-2 font-medium text-red-600 dark:text-red-300">
                <span className="size-2.5 animate-pulse rounded-full bg-red-500" />
                Grabando
              </span>
              <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
                {formatTime(elapsed)} / {formatTime(duration)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full bg-emerald-500 transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}

function preferredRecordingMimeType() {
  return [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ].find((type) => MediaRecorder.isTypeSupported(type));
}

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
