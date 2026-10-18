import {
  Download,
  FileAudio,
  FileImage,
  FileVideo,
  Trash2,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { formatBytes, formatDate } from "../../../shared/lib/format";
import type { MediaAsset, MediaAssetKind } from "../../../shared/types/domain";

const KIND_LABELS: Record<MediaAssetKind, string> = {
  PROJECT_COVER_IMAGE: "Portada del proyecto",
  ORIGINAL_AUDIO: "Audio original",
  ORIGINAL_VIDEO: "Video original",
  INSTRUMENTAL_STEM: "Pista instrumental",
  VOCAL_STEM: "Pista vocal",
  RECORDED_TAKE: "Grabacion vocal",
  FINAL_MIX: "Mezcla final",
  FACE_SWAP_SOURCE_IMAGE: "Rostro de referencia",
  FACE_SWAP_SOURCE_VIDEO: "Video para face swap",
  FACE_SWAP_RESULT_VIDEO: "Resultado de face swap",
  VIDEO_CLIP: "Clip generado",
  FINAL_VIDEOCLIP: "Videoclip final",
  KARAOKE_VIDEO: "Video karaoke",
};

function assetIcon(asset: MediaAsset) {
  if (asset.mimeType.startsWith("image/")) return FileImage;
  if (asset.mimeType.startsWith("video/")) return FileVideo;
  return FileAudio;
}

function statusLabel(asset: MediaAsset) {
  if (asset.status === "READY") return "Disponible";
  if (asset.status === "UPLOADING") return "Subiendo";
  return "Con error";
}

export function AssetList({
  assets,
  onDownload,
  onDelete,
  emptyText = "No hay archivos disponibles.",
  tone = "uploaded",
}: {
  assets: MediaAsset[];
  onDownload: (id: string) => void;
  onDelete?: (id: string) => void;
  emptyText?: string;
  tone?: "uploaded" | "generated";
}) {
  if (!assets.length) {
    return (
      <div className="grid min-h-36 place-items-center border-t border-zinc-200 px-5 text-center dark:border-white/10">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyText}</p>
      </div>
    );
  }

  const iconStyle =
    tone === "generated"
      ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300"
      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";

  return (
    <div className="divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-white/10 dark:border-white/10">
      {assets.map((asset) => {
        const Icon = assetIcon(asset);
        return (
          <article
            key={asset.id}
            className="flex flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap sm:px-6"
          >
            <span
              className={`grid size-11 shrink-0 place-items-center rounded-md ${iconStyle}`}
            >
              <Icon size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-sm text-zinc-950 dark:text-white">
                {asset.name}
              </strong>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                <span>{KIND_LABELS[asset.kind]}</span>
                <span aria-hidden="true">·</span>
                <span>{statusLabel(asset)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatBytes(asset.sizeBytes)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatDate(asset.createdAt)}</span>
              </div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button
                variant="icon"
                title="Descargar"
                aria-label={`Descargar ${asset.name}`}
                disabled={asset.status !== "READY"}
                onClick={() => onDownload(asset.id)}
              >
                <Download size={17} />
              </Button>
              {onDelete && (
                <Button
                  variant="danger"
                  className="size-10 px-0"
                  title="Eliminar"
                  aria-label={`Eliminar ${asset.name}`}
                  onClick={() => onDelete(asset.id)}
                >
                  <Trash2 size={17} />
                </Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
