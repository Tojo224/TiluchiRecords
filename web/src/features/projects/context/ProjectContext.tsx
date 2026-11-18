import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useToast } from "../../../components/ui/Toast";
import type {
  Job,
  JobType,
  MediaAsset,
  MediaAssetKind,
  Project,
} from "../../../shared/types/domain";
import { resolveMediaMimeType } from "../../../shared/media/asset-files";
import { TourProjectBridge } from "../../../tour/TourProjectBridge";

export type UploadProgressCallback = (
  percent: number,
  loadedBytes: number,
  totalBytes: number,
) => void;

type ProjectContextValue = {
  project: Project;
  assetUrls: Record<string, string>;
  refresh: () => Promise<void>;
  /** Requests fast polling; returns a function that releases the request. */
  retainFastPolling: () => () => void;
  createJob: (type: JobType, payload: Record<string, unknown>) => Promise<Job>;
  uploadFile: (
    file: File | Blob,
    fileName: string,
    kind: MediaAssetKind,
    durationSeconds?: number,
    onProgress?: UploadProgressCallback,
  ) => Promise<MediaAsset>;
  downloadAsset: (assetId: string) => Promise<void>;
  deleteAsset: (assetId: string) => Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

function isNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 404
  );
}

export function ProjectProviderLayout() {
  const { projectId } = useParams();
  const { api } = useAuth();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});

  // Keep the latest toast API in a ref so `refresh` stays referentially stable
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Track previous jobs to trigger toast notifications on completion
  const previousJobsRef = useRef<Map<string, string>>(new Map());

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api<Project>(`/projects/${projectId}`);

      // Notify the user about jobs that changed status since the last poll
      if (data.jobs && previousJobsRef.current.size > 0) {
        data.jobs.forEach((job) => {
          const prevStatus = previousJobsRef.current.get(job.id);
          if (prevStatus && prevStatus !== job.status) {
            if (job.status === "COMPLETED") {
              const friendlyName = formatJobType(job.type);
              toastRef.current.success(
                `${friendlyName} se completo con exito.`,
                "Proceso finalizado",
              );
            } else if (job.status === "FAILED") {
              const friendlyName = formatJobType(job.type);
              toastRef.current.error(
                job.errorMessage || "Ocurrio un error inesperado.",
                `Error en ${friendlyName}`,
              );
            }
          }
        });
      }

      if (data.jobs) {
        const nextMap = new Map<string, string>();
        data.jobs.forEach((j) => nextMap.set(j.id, j.status));
        previousJobsRef.current = nextMap;
      }

      setProject(data);
    } catch (error: unknown) {
      if (isNotFoundError(error)) setNotFound(true);
      else throw error;
    } finally {
      setLoading(false);
    }
  }, [api, projectId]);

  // Initial load
  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);
  const [fastPollingRequests, setFastPollingRequests] = useState(0);
  const retainFastPolling = useCallback(() => {
    let released = false;
    setFastPollingRequests((count) => count + 1);
    return () => {
      if (released) return;
      released = true;
      setFastPollingRequests((count) => count - 1);
    };
  }, []);

  // Smart adaptive polling: a single timer whose interval depends on whether
  // a page retained fast polling, jobs are running, or the project is idle.
  const hasActiveJobs = useMemo(
    () =>
      (project?.jobs || []).some(
        (job) => job.status === "PENDING" || job.status === "PROCESSING",
      ),
    [project?.jobs],
  );
  const pollInterval =
    fastPollingRequests > 0 ? 1000 : hasActiveJobs ? 2500 : 12000;

  useEffect(() => {
    let timer: number | null = null;

    function schedulePoll() {
      // Tab in background: poll much less often
      const delay = document.hidden ? 15000 : pollInterval;
      timer = window.setTimeout(() => {
        refresh().catch(() => undefined);
        schedulePoll();
      }, delay);
    }

    schedulePoll();

    const handleVisibilityChange = () => {
      if (!document.hidden) refresh().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pollInterval, refresh]);

  // Resolve download URLs for ready assets
  useEffect(() => {
    (project?.mediaAssets || [])
      .filter((asset) => asset.status === "READY" && !assetUrls[asset.id])
      .forEach((asset) => {
        api<{ downloadUrl: string }>(`/media/${asset.id}/download-url`)
          .then(({ downloadUrl }) =>
            setAssetUrls((current) => ({
              ...current,
              [asset.id]: downloadUrl,
            })),
          )
          .catch(() => undefined);
      });
  }, [api, assetUrls, project?.mediaAssets]);

  const createJob = useCallback(
    async (type: JobType, payload: Record<string, unknown>) => {
      const job = await api<Job>("/jobs", {
        method: "POST",
        body: JSON.stringify({ projectId, type, payload }),
      });
      toastRef.current.info(
        "Tarea enviada al motor de IA en segundo plano...",
        formatJobType(type),
      );
      await refresh();
      return job;
    },
    [api, projectId, refresh],
  );

  const uploadFile = useCallback(
    async (
      file: File | Blob,
      fileName: string,
      kind: MediaAssetKind,
      durationSeconds?: number,
      onProgress?: UploadProgressCallback,
    ) => {
      const mimeType = resolveMediaMimeType(fileName, file.type);
      const upload = await api<{ assetId: string; uploadUrl: string }>(
        "/media/upload-url",
        {
          method: "POST",
          body: JSON.stringify({
            projectId,
            fileName,
            mimeType,
            kind,
            sizeBytes: file.size,
          }),
        },
      );

      // Upload with real XHR progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", upload.uploadUrl);
        xhr.setRequestHeader("Content-Type", mimeType);

        if (onProgress) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              onProgress(percent, event.loaded, event.total);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            if (onProgress) onProgress(100, file.size, file.size);
            resolve();
          } else {
            reject(
              new Error(
                `Error al subir a almacenamiento S3 (status ${xhr.status})`,
              ),
            );
          }
        };

        xhr.onerror = () =>
          reject(new Error("Error de red al transferir archivo a MinIO."));
        xhr.send(file);
      });

      const asset = await api<MediaAsset>(`/media/${upload.assetId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ durationSeconds }),
      });

      toastRef.current.success(`Archivo "${fileName}" subido correctamente.`);
      await refresh();
      return asset;
    },
    [api, projectId, refresh],
  );

  const downloadAsset = useCallback(
    async (assetId: string) => {
      const { downloadUrl, name } = await api<{
        downloadUrl: string;
        name: string;
      }>(`/media/${assetId}/download-url`);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = name;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
    [api],
  );

  const deleteAsset = useCallback(
    async (assetId: string) => {
      await api(`/media/${assetId}`, { method: "DELETE" });
      setAssetUrls((current) => {
        const next = { ...current };
        delete next[assetId];
        return next;
      });
      toastRef.current.info("Archivo eliminado del proyecto.");
      await refresh();
    },
    [api, refresh],
  );

  const value = useMemo(
    () =>
      project
        ? {
            project,
            assetUrls,
            refresh,
            retainFastPolling,
            createJob,
            uploadFile,
            downloadAsset,
            deleteAsset,
          }
        : null,
    [
      assetUrls,
      project,
      refresh,
      retainFastPolling,
      createJob,
      uploadFile,
      downloadAsset,
      deleteAsset,
    ],
  );

  if (notFound) return <Navigate to="/projects" replace />;
  if (loading || !value)
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Cargando entorno de producción...
        </p>
      </div>
    );

  return (
    <ProjectContext.Provider value={value}>
      <TourProjectBridge />
      <Outlet />
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context)
    throw new Error("useProject must be used inside ProjectProviderLayout");
  return context;
}

export function findAsset(
  assets: MediaAsset[] | undefined,
  kind: MediaAssetKind,
) {
  return assets?.find(
    (asset) => asset.kind === kind && asset.status === "READY",
  );
}

function formatJobType(type: JobType): string {
  switch (type) {
    case "AUDIO_SEPARATION":
      return "Separación Instrumental & Vocal";
    case "GENERATE_FINAL_MIX":
      return "Mezcla de Audio Final";
    case "FACE_SWAP":
      return "Reemplazo Facial (Face Swap)";
    case "ANALYZE_AUDIO":
      return "Análisis Rítmico de Audio";
    case "GENERATE_STORYBOARD":
      return "Guion Gráfico (Storyboard)";
    case "GENERATE_VIDEO_CLIPS":
      return "Generación de Clips IA";
    case "COMPOSE_VIDEOCLIP":
      return "Composición de Videoclip";
    case "GENERATE_KARAOKE":
      return "Síntesis de Video Karaoke";
    default:
      return type;
  }
}
