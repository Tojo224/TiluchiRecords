import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import type {
  Job,
  JobType,
  MediaAsset,
  MediaAssetKind,
  Project,
} from "../../../shared/types/domain";
import { resolveMediaMimeType } from "../../../shared/media/asset-files";

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
  ) => Promise<MediaAsset>;
  downloadAsset: (assetId: string) => Promise<void>;
  deleteAsset: (assetId: string) => Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProviderLayout() {
  const { projectId } = useParams();
  const { api } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      setProject(await api<Project>(`/projects/${projectId}`));
    } catch (error: any) {
      if (error?.status === 404) setNotFound(true);
      else throw error;
    } finally {
      setLoading(false);
    }
  }, [api, projectId]);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);
  useEffect(() => {
    const interval = window.setInterval(
      () => refresh().catch(() => undefined),
      3000,
    );
    return () => window.clearInterval(interval);
  }, [refresh]);

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
    await refresh();
    return job;
  }

  async function uploadFile(
    file: File | Blob,
    fileName: string,
    kind: MediaAssetKind,
    durationSeconds?: number,
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
    const response = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: file,
    });
    if (!response.ok) throw new Error("No se pudo subir el archivo.");
    const asset = await api<MediaAsset>(`/media/${upload.assetId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ durationSeconds }),
    });
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
      <div className="py-20 text-center text-sm text-zinc-500">
        Cargando proyecto...
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
