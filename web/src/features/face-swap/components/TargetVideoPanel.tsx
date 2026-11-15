import { FileVideo2, Loader2, Video } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { AssetSelect } from "@/features/media/components/AssetSelect";
import { FileUpload } from "@/features/media/components/FileUpload";
import { formatBytes } from "@/shared/lib/format";
import { VIDEO_FILE_ACCEPT } from "@/shared/media/asset-files";
import type { MediaAsset } from "@/shared/types/domain";
import { formatVideoDuration } from "../lib/face-swap-state";
import { SectionHeading } from "./SectionHeading";

type TargetVideoPanelProps = {
  videos: MediaAsset[];
  video: MediaAsset | undefined;
  videoId: string;
  assetUrls: Record<string, string>;
  disabled: boolean;
  onVideoChange: (assetId: string) => void;
  onUpload: (file: File) => Promise<void>;
};

export function TargetVideoPanel({
  videos,
  video,
  videoId,
  assetUrls,
  disabled,
  onVideoChange,
  onUpload,
}: TargetVideoPanelProps) {
  return (
    <Panel className="overflow-hidden border-cyan-200/80 bg-gradient-to-br from-white via-white to-cyan-50/50 p-0 dark:border-cyan-500/20 dark:from-[#0b171c] dark:via-[#0b171c] dark:to-cyan-950/20">
      <SectionHeading
        icon={<Video size={22} />}
        title="Video objetivo"
        description="Video donde se reemplazaran los rostros seleccionados."
      />
      <div className="px-5 pb-5">
        <AssetSelect
          label="Video del proyecto"
          assets={videos}
          value={videoId}
          onChange={onVideoChange}
          disabled={disabled}
        />
        {video && (
          <div className="mt-3 grid overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#081216] sm:grid-cols-[minmax(0,1.35fr)_minmax(180px,0.65fr)]">
            <div className="grid min-h-52 place-items-center bg-zinc-950 sm:min-h-64">
              {assetUrls[video.id] ? (
                <video
                  className="size-full max-h-64 object-contain"
                  controls
                  preload="metadata"
                  src={assetUrls[video.id]}
                  aria-label={`Vista previa de ${video.name}`}
                />
              ) : (
                <Loader2 className="animate-spin text-zinc-400" size={24} />
              )}
            </div>
            <div className="flex min-w-0 flex-col justify-between gap-4 border-t border-zinc-200 p-4 dark:border-white/10 sm:border-l sm:border-t-0">
              <div className="flex min-w-0 gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                  <FileVideo2 size={21} />
                </span>
                <div className="min-w-0">
                  <strong className="block truncate text-sm">
                    {video.name}
                  </strong>
                  <div className="mt-2 grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      {formatVideoDuration(
                        Number(
                          video.durationSeconds ||
                            video.metadata?.durationSeconds ||
                            0,
                        ),
                      )}
                    </span>
                    <span>{formatBytes(video.sizeBytes)}</span>
                    <span>
                      {video.mimeType.split("/")[1]?.toUpperCase() || "VIDEO"}
                    </span>
                  </div>
                </div>
              </div>
              <FileUpload
                accept={VIDEO_FILE_ACCEPT}
                label="Cambiar video"
                busy={disabled}
                onSelect={onUpload}
              />
            </div>
          </div>
        )}
        {!video && (
          <div className="mt-3 flex min-h-52 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 text-center dark:border-white/10 dark:bg-[#081216]">
            <FileVideo2 className="text-zinc-400" size={34} strokeWidth={1.5} />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Selecciona o sube el video que deseas editar.
            </p>
            <FileUpload
              accept={VIDEO_FILE_ACCEPT}
              label="Subir video"
              busy={disabled}
              onSelect={onUpload}
            />
          </div>
        )}
      </div>
    </Panel>
  );
}
