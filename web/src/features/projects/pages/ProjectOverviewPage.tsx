import {
  ArrowRight,
  FileInput,
  FileOutput,
  FilePenLine,
  FolderOpen,
  Image as ImageIcon,
  Mic2,
  Music2,
  Save,
  Trash2,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { FileUpload } from "../../media/components/FileUpload";
import { useProject } from "../context/ProjectContext";
import {
  PROJECT_COVER_ACCEPT,
  validateProjectCover,
} from "../lib/project-cover";

const flows: Array<{
  slug: string;
  title: string;
  text: string;
  icon: LucideIcon;
  surface: string;
  iconStyle: string;
}> = [
  {
    slug: "karaoke",
    title: "Karaoke",
    text: "Video instrumental con letra sincronizada.",
    icon: Mic2,
    surface:
      "border-emerald-200 bg-emerald-50/70 hover:border-emerald-400 dark:border-emerald-500/25 dark:bg-emerald-500/[0.07] dark:hover:border-emerald-400/60",
    iconStyle:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    slug: "face-swap",
    title: "Face swap",
    text: "Reemplazo facial autorizado en video.",
    icon: Wand2,
    surface:
      "border-cyan-200 bg-cyan-50/70 hover:border-cyan-400 dark:border-cyan-500/25 dark:bg-cyan-500/[0.07] dark:hover:border-cyan-400/60",
    iconStyle:
      "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  },
  {
    slug: "music-video",
    title: "Video desde musica",
    text: "Generacion visual sincronizada con tu cancion.",
    icon: Music2,
    surface:
      "border-violet-200 bg-violet-50/70 hover:border-violet-400 dark:border-violet-500/25 dark:bg-violet-500/[0.07] dark:hover:border-violet-400/60",
    iconStyle:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
];

export function ProjectOverviewPage() {
  const { project, assetUrls, uploadFile, deleteAsset, refresh } = useProject();
  const { api } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingCover, setSavingCover] = useState(false);
  const assets = project.mediaAssets || [];
  const cover =
    project.coverImage ||
    assets.find(
      (asset) =>
        asset.kind === "PROJECT_COVER_IMAGE" && asset.status === "READY",
    );
  const uploadedCount = assets.filter(
    (asset) =>
      asset.origin === "UPLOADED" && asset.kind !== "PROJECT_COVER_IMAGE",
  ).length;
  const generatedCount = assets.filter(
    (asset) => asset.origin === "GENERATED",
  ).length;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await api(`/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: String(form.get("name") || "").trim(),
          description: String(form.get("description") || "").trim(),
        }),
      });
      await refresh();
      setMessage("Proyecto actualizado correctamente.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Eliminar este proyecto y todos sus registros?"))
      return;
    setDeleting(true);
    setMessage("");
    try {
      await api(`/projects/${project.id}`, { method: "DELETE" });
      navigate("/projects");
    } catch (error) {
      setMessage((error as Error).message);
      setDeleting(false);
    }
  }

  async function replaceCover(file: File) {
    setSavingCover(true);
    setMessage("");
    try {
      validateProjectCover(file);
      const previousCoverId = cover?.id;
      await uploadFile(file, file.name, "PROJECT_COVER_IMAGE");
      if (previousCoverId) {
        await deleteAsset(previousCoverId).catch(() => undefined);
      }
      await refresh();
      setMessage("Portada actualizada correctamente.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSavingCover(false);
    }
  }

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <h2 className="truncate text-3xl font-semibold text-zinc-950 dark:text-white">
            {project.name}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {project.description || "Proyecto de produccion audiovisual"}
          </p>
        </div>
        <Link to={`/projects/${project.id}/files`}>
          <Button variant="secondary">
            <FolderOpen size={18} />
            Archivos
          </Button>
        </Link>
      </header>

      <Notice
        message={message}
        tone={message.includes("correctamente") ? "success" : "error"}
      />

      <section
        className="grid gap-4 md:grid-cols-3"
        aria-label="Flujos creativos"
      >
        {flows.map(({ slug, title, text, icon: Icon, surface, iconStyle }) => (
          <Link
            key={slug}
            to={`/projects/${project.id}/${slug}`}
            className={`group flex min-h-28 items-center gap-4 rounded-lg border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${surface}`}
          >
            <span
              className={`grid size-12 shrink-0 place-items-center rounded-lg ${iconStyle}`}
            >
              <Icon size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-zinc-950 dark:text-white">
                {title}
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {text}
              </p>
            </div>
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-current/20 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-zinc-950 dark:text-zinc-400 dark:group-hover:text-white">
              <ArrowRight size={17} />
            </span>
          </Link>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0b171c] dark:shadow-black/20">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-white/10 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <FilePenLine size={20} />
            </span>
            <div>
              <h3 className="font-semibold">Datos del proyecto</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Edita la informacion basica de tu produccion.
              </p>
            </div>
          </div>
          <Button variant="danger" onClick={remove} disabled={deleting}>
            <Trash2 size={17} />
            {deleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </header>
        <form
          className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(300px,0.9fr)_minmax(360px,1.1fr)] lg:items-stretch"
          onSubmit={save}
        >
          <div className="min-w-0">
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-[#081216]">
              {cover && assetUrls[cover.id] ? (
                <img
                  className="aspect-[16/8] w-full object-cover"
                  src={assetUrls[cover.id]}
                  alt={`Portada de ${project.name}`}
                />
              ) : (
                <div className="grid aspect-[16/8] place-items-center text-zinc-400">
                  <ImageIcon size={34} strokeWidth={1.5} />
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <strong className="block text-sm">Foto de portada</strong>
                <span className="text-xs text-zinc-400">
                  JPG, PNG o WebP, hasta 10 MB.
                </span>
              </div>
              <FileUpload
                accept={PROJECT_COVER_ACCEPT}
                label={cover ? "Cambiar portada" : "Subir portada"}
                busy={savingCover || deleting}
                onSelect={replaceCover}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <label>
              Nombre
              <input
                name="name"
                defaultValue={project.name}
                maxLength={100}
                required
              />
            </label>
            <label className="flex-1">
              Descripcion
              <textarea
                className="min-h-28 flex-1"
                name="description"
                defaultValue={project.description || ""}
                maxLength={500}
              />
            </label>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || deleting}>
                <Save size={17} />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </form>
      </section>

      <section
        className="grid gap-4 sm:grid-cols-2"
        aria-label="Archivos del proyecto"
      >
        <Link
          to={`/projects/${project.id}/files`}
          className="group flex min-h-36 items-center gap-5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm transition hover:border-emerald-400 hover:shadow-md dark:border-emerald-500/25 dark:bg-emerald-500/[0.07] dark:hover:border-emerald-400/60"
        >
          <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <FileInput size={27} />
          </span>
          <span className="min-w-0">
            <strong className="block text-3xl text-zinc-950 dark:text-white">
              {uploadedCount}
            </strong>
            <span className="mt-1 block font-semibold">Archivos cargados</span>
            <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
              Recursos que agregaste al proyecto.
            </span>
          </span>
          <ArrowRight
            className="ml-auto shrink-0 text-zinc-400 transition group-hover:translate-x-1 group-hover:text-emerald-600"
            size={20}
          />
        </Link>

        <Link
          to={`/projects/${project.id}/results`}
          className="group flex min-h-36 items-center gap-5 rounded-lg border border-cyan-200 bg-cyan-50/70 p-5 shadow-sm transition hover:border-cyan-400 hover:shadow-md dark:border-cyan-500/25 dark:bg-cyan-500/[0.07] dark:hover:border-cyan-400/60"
        >
          <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
            <FileOutput size={27} />
          </span>
          <span className="min-w-0">
            <strong className="block text-3xl text-zinc-950 dark:text-white">
              {generatedCount}
            </strong>
            <span className="mt-1 block font-semibold">Archivos generados</span>
            <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
              Resultados producidos por las herramientas.
            </span>
          </span>
          <ArrowRight
            className="ml-auto shrink-0 text-zinc-400 transition group-hover:translate-x-1 group-hover:text-cyan-600"
            size={20}
          />
        </Link>
      </section>
    </>
  );
}
