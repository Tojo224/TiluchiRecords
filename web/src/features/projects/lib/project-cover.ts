import { resolveMediaMimeType } from "../../../shared/media/asset-files";
import type { MediaAsset } from "../../../shared/types/domain";

export const PROJECT_COVER_ACCEPT =
  "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
export const PROJECT_COVER_MAX_BYTES = 10 * 1024 * 1024;

type ApiClient = <T>(path: string, options?: RequestInit) => Promise<T>;

export function validateProjectCover(file: File) {
  const mimeType = resolveMediaMimeType(file.name, file.type);
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    throw new Error("La portada debe ser una imagen JPG, PNG o WebP.");
  }
  if (file.size > PROJECT_COVER_MAX_BYTES) {
    throw new Error("La portada no puede superar los 10 MB.");
  }
  return mimeType;
}

export async function uploadProjectCover(
  api: ApiClient,
  projectId: string,
  file: File,
) {
  const mimeType = validateProjectCover(file);
  const upload = await api<{ assetId: string; uploadUrl: string }>(
    "/media/upload-url",
    {
      method: "POST",
      body: JSON.stringify({
        projectId,
        fileName: file.name,
        mimeType,
        kind: "PROJECT_COVER_IMAGE",
        sizeBytes: file.size,
      }),
    },
  );
  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: file,
  });
  if (!response.ok) throw new Error("No se pudo subir la portada.");
  return api<MediaAsset>(`/media/${upload.assetId}/confirm`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
