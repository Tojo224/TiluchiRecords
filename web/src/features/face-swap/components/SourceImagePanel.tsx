import { Image as ImageIcon, Loader2, UserRound } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { AssetSelect } from "@/features/media/components/AssetSelect";
import { FileUpload } from "@/features/media/components/FileUpload";
import { IMAGE_FILE_ACCEPT } from "@/shared/media/asset-files";
import { TOUR_ANCHORS } from "@/tour/anchors";
import type { MediaAsset } from "@/shared/types/domain";
import { SectionHeading } from "./SectionHeading";

type SourceImagePanelProps = {
  images: MediaAsset[];
  image: MediaAsset | undefined;
  imageId: string;
  assetUrls: Record<string, string>;
  disabled: boolean;
  onImageChange: (assetId: string) => void;
  onUpload: (file: File) => Promise<void>;
};

export function SourceImagePanel({
  images,
  image,
  imageId,
  assetUrls,
  disabled,
  onImageChange,
  onUpload,
}: SourceImagePanelProps) {
  return (
    <Panel className="overflow-hidden border-emerald-200/80 bg-gradient-to-br from-white via-white to-emerald-50/50 p-0 dark:border-emerald-500/20 dark:from-[#0b171c] dark:via-[#0b171c] dark:to-emerald-950/20">
      <SectionHeading
        icon={<UserRound size={22} />}
        title="Rostro fuente"
        description="Imagen que se usara para reemplazar los rostros."
      />
      <div className="px-5 pb-5">
        {images.length === 0 ? (
          <div className="mt-2">
            <FileUpload
              mode="dropzone"
              anchor={TOUR_ANCHORS.faceSwapImageDropzone}
              accept={IMAGE_FILE_ACCEPT}
              label="Arrastra una foto del rostro aqui o haz clic para subir"
              busy={disabled}
              onSelect={onUpload}
            />
          </div>
        ) : (
          <>
            <AssetSelect
              label="Imagen del proyecto"
              assets={images}
              value={imageId}
              onChange={onImageChange}
              disabled={disabled}
            />
            {image && (
              <figure className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 shadow-sm dark:border-white/10 dark:bg-[#061014]">
                <div className="grid h-52 place-items-center sm:h-60 lg:h-64">
                  {assetUrls[image.id] ? (
                    <img
                      className="size-full object-contain"
                      src={assetUrls[image.id]}
                      alt={`Vista previa de ${image.name}`}
                    />
                  ) : (
                    <div className="grid justify-items-center gap-2 text-zinc-500 dark:text-zinc-400">
                      <Loader2 className="animate-spin" size={24} />
                      <span className="text-xs">Cargando vista previa</span>
                    </div>
                  )}
                </div>
                <figcaption className="flex min-w-0 items-center gap-2 border-t border-zinc-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-[#0b171c]">
                  <ImageIcon
                    className="shrink-0 text-emerald-600 dark:text-emerald-400"
                    size={17}
                  />
                  <span className="truncate text-sm font-medium">
                    {image.name}
                  </span>
                </figcaption>
              </figure>
            )}
            <div className="mt-3 flex justify-end">
              <FileUpload
                accept={IMAGE_FILE_ACCEPT}
                label={image ? "Cambiar imagen" : "Subir imagen"}
                anchor={TOUR_ANCHORS.faceSwapImageButton}
                busy={disabled}
                onSelect={onUpload}
              />
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
