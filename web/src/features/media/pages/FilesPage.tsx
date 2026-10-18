import { FileInput, FileOutput, UploadCloud } from "lucide-react";
import { useState } from "react";
import { Notice } from "../../../components/ui/Notice";
import { PageHeader } from "../../../components/ui/PageHeader";
import { AssetList } from "../components/AssetList";
import { FileUpload } from "../components/FileUpload";
import { useProject } from "../../projects/context/ProjectContext";
import {
  IMAGE_FILE_ACCEPT,
  MUSIC_FILE_ACCEPT,
  VIDEO_FILE_ACCEPT,
} from "../../../shared/media/asset-files";
import type { MediaAssetKind } from "../../../shared/types/domain";

export function FilesPage() {
  const { project, uploadFile, downloadAsset, deleteAsset } = useProject();
  const [message, setMessage] = useState("");
  const assets = project.mediaAssets || [];
  const uploadedAssets = assets.filter(
    (asset) =>
      asset.origin === "UPLOADED" && asset.kind !== "PROJECT_COVER_IMAGE",
  );
  const generatedAssets = assets.filter(
    (asset) => asset.origin === "GENERATED",
  );

  async function upload(file: File, kind: MediaAssetKind, label: string) {
    try {
      await uploadFile(file, file.name, kind);
      setMessage(`${label} subido correctamente.`);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Eliminar este archivo?")) return;
    try {
      await deleteAsset(id);
      setMessage("Archivo eliminado correctamente.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Archivos"
        description={`Recursos y resultados de ${project.name}.`}
      />

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0b171c] dark:shadow-black/20 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            <UploadCloud size={22} />
          </span>
          <div>
            <h2 className="font-semibold">Cargar archivos fuente</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Agrega musica, videos o imagenes para utilizar en las
              herramientas.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <FileUpload
            accept={MUSIC_FILE_ACCEPT}
            label="Subir musica"
            onSelect={(file) => upload(file, "ORIGINAL_AUDIO", "Musica")}
          />
          <FileUpload
            accept={VIDEO_FILE_ACCEPT}
            label="Subir video"
            onSelect={(file) => upload(file, "ORIGINAL_VIDEO", "Video")}
          />
          <FileUpload
            accept={IMAGE_FILE_ACCEPT}
            label="Subir rostro"
            onSelect={(file) =>
              upload(file, "FACE_SWAP_SOURCE_IMAGE", "Imagen")
            }
          />
        </div>
      </section>

      <Notice
        message={message}
        tone={message.includes("correctamente") ? "success" : "error"}
      />

      <section className="overflow-hidden rounded-lg border border-emerald-200 bg-white shadow-sm dark:border-emerald-500/25 dark:bg-[#0b171c] dark:shadow-black/20">
        <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <FileInput size={24} />
            </span>
            <div>
              <h2 className="font-semibold text-zinc-950 dark:text-white">
                Archivos cargados
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Recursos que agregaste manualmente al proyecto.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            {uploadedAssets.length}{" "}
            {uploadedAssets.length === 1 ? "archivo" : "archivos"}
          </span>
        </header>
        <AssetList
          assets={uploadedAssets}
          onDownload={downloadAsset}
          onDelete={remove}
          emptyText="Todavia no cargaste archivos en este proyecto."
          tone="uploaded"
        />
      </section>

      <section className="overflow-hidden rounded-lg border border-cyan-200 bg-white shadow-sm dark:border-cyan-500/25 dark:bg-[#0b171c] dark:shadow-black/20">
        <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
              <FileOutput size={24} />
            </span>
            <div>
              <h2 className="font-semibold text-zinc-950 dark:text-white">
                Archivos generados
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Resultados creados por Karaoke, Face swap y Video desde musica.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300">
            {generatedAssets.length}{" "}
            {generatedAssets.length === 1 ? "archivo" : "archivos"}
          </span>
        </header>
        <AssetList
          assets={generatedAssets}
          onDownload={downloadAsset}
          onDelete={remove}
          emptyText="Todavia no hay resultados generados en este proyecto."
          tone="generated"
        />
      </section>
    </>
  );
}
