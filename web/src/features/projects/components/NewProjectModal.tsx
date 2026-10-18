import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { FolderPlus, ImagePlus, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import type { Project } from "../../../shared/types/domain";
import {
  PROJECT_COVER_ACCEPT,
  uploadProjectCover,
  validateProjectCover,
} from "../lib/project-cover";

export function NewProjectModal({ onClose }: { onClose: () => void }) {
  const { api } = useAuth();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    nameInputRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(
    () => () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    },
    [coverPreview],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const project = await api<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name") || "").trim(),
          description: String(form.get("description") || "").trim(),
        }),
      });
      if (coverFile) {
        try {
          await uploadProjectCover(api, project.id, coverFile);
        } catch (error) {
          await api(`/projects/${project.id}`, { method: "DELETE" }).catch(
            () => undefined,
          );
          throw error;
        }
      }
      onClose();
      navigate(`/projects/${project.id}`);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function selectCover(file?: File) {
    if (!file) return;
    try {
      validateProjectCover(file);
      setError("");
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    } catch (error) {
      setError((error as Error).message);
    }
  }

  function clearCover() {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview("");
    if (coverInputRef.current) coverInputRef.current.value = "";
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !busy) {
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), textarea:not([disabled])",
      ) || [],
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/65 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
        className="w-full max-w-xl overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0b171c] dark:shadow-black/50"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-5 dark:border-white/10 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <FolderPlus size={24} />
            </span>
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                Nuevo proyecto
              </h2>
              <p
                id={descriptionId}
                className="mt-1 text-sm text-zinc-500 dark:text-zinc-400"
              >
                Crea el espacio para reunir archivos y resultados.
              </p>
            </div>
          </div>
          <Button
            variant="icon"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar modal"
            title="Cerrar"
          >
            <X size={19} />
          </Button>
        </header>

        <form onSubmit={submit}>
          <div className="grid gap-5 px-5 py-6 sm:px-6">
            <Notice message={error} tone="error" />
            <div>
              <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Foto de portada{" "}
                <span className="font-normal text-zinc-400">(opcional)</span>
              </span>
              <input
                ref={coverInputRef}
                className="sr-only"
                type="file"
                accept={PROJECT_COVER_ACCEPT}
                aria-label="Foto de portada"
                onChange={(event) => selectCover(event.target.files?.[0])}
              />
              {coverPreview ? (
                <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-[#081216]">
                  <img
                    className="aspect-[16/6] w-full object-cover"
                    src={coverPreview}
                    alt="Vista previa de la portada"
                  />
                  <div className="absolute bottom-3 right-3 flex gap-2">
                    <Button
                      variant="secondary"
                      className="shadow-lg"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={busy}
                    >
                      <ImagePlus size={17} /> Cambiar
                    </Button>
                    <Button
                      variant="danger"
                      className="size-10 bg-white px-0 shadow-lg dark:bg-red-950"
                      onClick={clearCover}
                      disabled={busy}
                      aria-label="Quitar portada"
                    >
                      <Trash2 size={17} />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="grid min-h-28 w-full place-items-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-5 text-center transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-white/15 dark:bg-[#081216] dark:hover:border-emerald-500 dark:hover:bg-emerald-500/5"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={busy}
                >
                  <span className="grid justify-items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <ImagePlus size={24} />
                    Seleccionar imagen
                    <small>JPG, PNG o WebP, hasta 10 MB</small>
                  </span>
                </button>
              )}
            </div>
            <label>
              Nombre
              <input
                ref={nameInputRef}
                name="name"
                maxLength={100}
                required
                autoComplete="off"
                placeholder="Ej. Sesion acustica"
              />
            </label>
            <label>
              Descripcion
              <textarea
                name="description"
                maxLength={500}
                placeholder="Objetivo de la produccion"
              />
            </label>
          </div>
          <footer className="flex flex-col-reverse gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-white/10 dark:bg-[#081216] sm:flex-row sm:justify-end sm:px-6">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              <FolderPlus size={18} />
              {busy ? "Creando..." : "Crear proyecto"}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}
