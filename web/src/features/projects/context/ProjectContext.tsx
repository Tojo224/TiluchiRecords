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

export type UploadProgressCallback = (
  percent: number,
  loadedBytes: number,
  totalBytes: number,
) => void;

type ProjectContextValue = {
  project: Project;
  assetUrls: Record<string, string>;
  refresh: () => Promise<void>;
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

export function ProjectProviderLayout() {
  const { projectId } = useParams();
  const { api } = useAuth();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  
  // Track previous jobs to trigger toast notifications on completion
  const previousJobsRef = useRef<Map<string, string>>(new Map());

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api<Project>(`/projects/${projectId}`);
      
      // Check for completed or failed jobs to notify user
      if (data.jobs && previousJobsRef.current.size > 0) {
        data.jobs.forEach((job) => {
          const prevStatus = previousJobsRef.current.get(job.id);
          if (prevStatus && prevStatus !== job.status) {
            if (job.status === "COMPLETED") {
              const friendlyName = formatJobType(job.type);
              toast.success(`${friendlyName} se completó con éxito.`, "Proceso Finalizado");
            } else if (job.status === "FAILED") {
              const friendlyName = formatJobType(job.type);
              toast.error(
                job.errorMessage || "Ocurrió un error inesperado.",
                `Error en ${friendlyName}`,
              );
            }
          }
        });
      }

      // Update ref
      if (data.jobs) {
        const nextMap = new Map<string, string>();
        data.jobs.forEach((j) => nextMap.set(j.id, j.status));
        previousJobsRef.current = nextMap;
      }

      setProject(data);
    } catch (error: any) {
      if (error?.status === 404) setNotFound(true);
      else throw error;
    } finally {
      setLoading(false);
    }
  }, [api, projectId, toast]);

  // Initial load
  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  // Smart Adaptive Polling
  useEffect(() => {
    const hasActiveJobs = (project?.jobs || []).some(
      (job) => job.status === "PENDING" || job.status === "PROCESSING",
    );

    // Fast polling (2.5s) if jobs are processing, relaxed (12s) if idle
    const pollInterval = hasActiveJobs ? 2500 : 12000;

    let timer: number | null = null;

    function schedulePoll() {
      if (document.hidden) {
        // Tab in background: delay poll
        timer = window.setTimeout(() => {
          refresh().catch(() => undefined);
          schedulePoll();
        }, 15000);
        return;
      }

      timer = window.setTimeout(() => {
        refresh().catch(() => undefined);
        schedulePoll();
      }, pollInterval);
    }

    schedulePoll();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refresh().catch(() => undefined);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [project?.jobs, refresh]);

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

  async function createJob(type: JobType, payload: Record<string, unknown>) {
    const job = await api<Job>("/jobs", {
      method: "POST",
      body: JSON.stringify({ projectId, type, payload }),
    });
    toast.info("Tarea enviada al motor de IA en segundo plano...", formatJobType(type));
    await refresh();
    return job;
  }

  async function uploadFile(
    file: File | Blob,
    fileName: string,
    kind: MediaAssetKind,
    durationSeconds?: number,
    onProgress?: UploadProgressCallback,
  ) {
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
          reject(new Error(`Error al subir a almacenamiento S3 (status ${xhr.status})`));
        }
      };

      xhr.onerror = () => reject(new Error("Error de red al transferir archivo a MinIO."));
      xhr.send(file);
    });

    const asset = await api<MediaAsset>(`/media/${upload.assetId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ durationSeconds }),
    });

    toast.success(`Archivo "${fileName}" subido correctamente.`);
    await refresh();
    return asset;
  }

  async function downloadAsset(assetId: string) {
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
  }

  async function deleteAsset(assetId: string) {
    await api(`/media/${assetId}`, { method: "DELETE" });
    setAssetUrls((current) => {
      const next = { ...current };
      delete next[assetId];
      return next;
    });
    toast.info("Archivo eliminado del proyecto.");
    await refresh();
  }

  const value = useMemo(
    () =>
      project
        ? {
            project,
            assetUrls,
            refresh,
            createJob,
            uploadFile,
            downloadAsset,
            deleteAsset,
          }
        : null,
    [assetUrls, project, refresh],
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
