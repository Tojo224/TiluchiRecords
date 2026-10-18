import {
  ArrowRight,
  CalendarDays,
  FileUp,
  Files,
  FolderOpen,
  ListChecks,
  Mic2,
  Music2,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { Panel } from "../../../components/ui/Panel";
import { formatDate } from "../../../shared/lib/format";
import type { MediaAssetKind, Project } from "../../../shared/types/domain";
import { useProjects } from "../../projects/hooks/useProjects";
import { ProjectCoverImage } from "../../projects/components/ProjectCoverImage";

const HERO_IMAGE_DARK = "/assets/dashboard-studio-hero.png";
const HERO_IMAGE_LIGHT = "/assets/dashboard-studio-hero-light.png";

export function DashboardPage() {
  const { user, api } = useAuth();
  const { projects, loading } = useProjects();
  const [projectDetails, setProjectDetails] = useState<Project[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    let active = true;
    if (!projects.length) {
      setProjectDetails([]);
      return;
    }
    setLoadingDetails(true);
    Promise.all(
      projects.map((project) => api<Project>(`/projects/${project.id}`)),
    )
      .then((details) => {
        if (active) setProjectDetails(details);
      })
      .catch(() => {
        if (active) setProjectDetails([]);
      })
      .finally(() => {
        if (active) setLoadingDetails(false);
      });
    return () => {
      active = false;
    };
  }, [api, projects]);

  const stats = useMemo(() => {
    const assets = projectDetails.flatMap(
      (project) => project.mediaAssets || [],
    );
    const countReady = (kind: MediaAssetKind) =>
      assets.filter((asset) => asset.kind === kind && asset.status === "READY")
        .length;
    return {
      projects: projects.length,
      uploads: assets.filter(
        (asset) =>
          asset.origin === "UPLOADED" &&
          asset.status === "READY" &&
          asset.kind !== "PROJECT_COVER_IMAGE",
      ).length,
      karaoke: countReady("KARAOKE_VIDEO"),
      faceSwap: countReady("FACE_SWAP_RESULT_VIDEO"),
      musicVideo: countReady("FINAL_VIDEOCLIP"),
    };
  }, [projectDetails, projects.length]);

  const activeProject = projects[0];
  const tools = [
    {
      title: "Karaoke",
      description: "Video instrumental con letra sincronizada.",
      icon: Mic2,
      href: activeProject
        ? `/projects/${activeProject.id}/karaoke`
        : "/projects",
      tone: "emerald",
    },
    {
      title: "Face swap",
      description: "Reemplazo facial autorizado en video.",
      icon: Wand2,
      href: activeProject
        ? `/projects/${activeProject.id}/face-swap`
        : "/projects",
      tone: "rose",
    },
    {
      title: "Videoclip",
      description: "Video generado y sincronizado desde musica.",
      icon: Music2,
      href: activeProject
        ? `/projects/${activeProject.id}/music-video`
        : "/projects",
      tone: "amber",
    },
  ] as const;

  return (
    <>
      <section className="relative isolate min-h-44 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 shadow-sm dark:border-white/10 dark:bg-[#061217]">
        <img
          className="absolute inset-0 -z-20 size-full object-cover object-center dark:hidden"
          src={HERO_IMAGE_LIGHT}
          alt="Microfono profesional en un estudio de grabacion iluminado"
        />
        <img
          className="absolute inset-0 -z-20 hidden size-full object-cover object-center dark:block"
          src={HERO_IMAGE_DARK}
          alt=""
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-white/95 via-white/75 to-white/5 dark:from-[#061217] dark:via-[#061217]/90 dark:to-[#061217]/10" />
        <div className="relative z-10 flex min-h-44 max-w-3xl flex-col justify-center px-6 py-8 sm:px-9">
          <span className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">
            Bienvenido de nuevo
          </span>
          <h1 className="text-3xl font-bold text-zinc-950 dark:text-white sm:text-4xl">
            Hola,{" "}
            <span className="text-emerald-700 dark:text-emerald-300">
              {user?.name || "creador"}
            </span>
          </h1>
          <p className="mt-2 text-base text-zinc-700 dark:text-zinc-200 sm:text-lg">
            Continua una produccion o inicia un nuevo proyecto.
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={FolderOpen}
          label="Proyectos"
          value={stats.projects}
          tone="violet"
        />
        <MetricCard
          icon={FileUp}
          label="Archivos cargados"
          value={stats.uploads}
          tone="blue"
          loading={loadingDetails}
        />
        <MetricCard
          icon={Mic2}
          label="Karaoke generado"
          value={stats.karaoke}
          tone="emerald"
          loading={loadingDetails}
        />
        <MetricCard
          icon={Wand2}
          label="Face swap generado"
          value={stats.faceSwap}
          tone="rose"
          loading={loadingDetails}
        />
        <MetricCard
          icon={Music2}
          label="Videoclip generado"
          value={stats.musicVideo}
          tone="amber"
          loading={loadingDetails}
        />
      </section>

      <Panel className="p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Herramientas</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Selecciona una herramienta para empezar a crear.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {tools.map((tool) => (
            <ToolLink key={tool.title} {...tool} />
          ))}
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Proyectos recientes</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Tus proyectos actualizados recientemente.
            </p>
          </div>
          <Link
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
            to="/projects"
          >
            Ver todos <ArrowRight size={17} />
          </Link>
        </div>

        {loading ? (
          <div className="h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-white/5" />
        ) : projects.length ? (
          <div className="grid gap-3">
            {projects.slice(0, 3).map((project, index) => (
              <RecentProject
                key={project.id}
                project={project}
                featured={index === 0}
              />
            ))}
          </div>
        ) : (
          <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-center dark:border-white/10 dark:bg-[#081216]">
            <div className="grid justify-items-center gap-2 px-5 text-zinc-500 dark:text-zinc-400">
              <FolderOpen size={28} strokeWidth={1.5} />
              <p className="text-sm">Todavia no tienes proyectos.</p>
              <Link
                className="text-sm font-semibold text-emerald-700 dark:text-emerald-400"
                to="/projects"
              >
                Crear el primero
              </Link>
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}

type Tone = "violet" | "blue" | "emerald" | "rose" | "amber";

const tones: Record<Tone, { card: string; icon: string }> = {
  violet: {
    card: "border-violet-200 bg-violet-50/80 dark:border-violet-500/35 dark:bg-violet-950/30",
    icon: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  },
  blue: {
    card: "border-sky-200 bg-sky-50/80 dark:border-sky-500/35 dark:bg-sky-950/30",
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  },
  emerald: {
    card: "border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/35 dark:bg-emerald-950/30",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
  rose: {
    card: "border-rose-200 bg-rose-50/80 dark:border-rose-500/35 dark:bg-rose-950/30",
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  },
  amber: {
    card: "border-amber-200 bg-amber-50/80 dark:border-amber-500/35 dark:bg-amber-950/30",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  },
};

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
  loading = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: Tone;
  loading?: boolean;
}) {
  return (
    <article
      className={`relative min-h-28 overflow-hidden rounded-lg border p-4 shadow-sm ${tones[tone].card}`}
    >
      <div className="relative z-10 flex items-center gap-3">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-lg ${tones[tone].icon}`}
        >
          <Icon size={24} />
        </span>
        <div className="min-w-0">
          <span className="block min-h-9 text-sm leading-tight text-zinc-600 dark:text-zinc-300">
            {label}
          </span>
          <strong className="mt-1 block text-3xl font-bold tabular-nums">
            {loading ? "..." : value}
          </strong>
        </div>
      </div>
      <span className="absolute -bottom-7 -right-4 size-24 rounded-full border border-current opacity-10" />
      <span className="absolute -bottom-9 right-5 size-20 rounded-full border border-current opacity-10" />
    </article>
  );
}

function ToolLink({
  title,
  description,
  icon: Icon,
  href,
  tone,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  tone: "emerald" | "rose" | "amber";
}) {
  return (
    <Link
      to={href}
      className={`group flex min-h-28 items-center gap-4 rounded-lg border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${tones[tone].card}`}
    >
      <span
        className={`grid size-14 shrink-0 place-items-center rounded-lg ${tones[tone].icon}`}
      >
        <Icon size={28} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block">{title}</strong>
        <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-300">
          {description}
        </span>
      </span>
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-white/70 text-zinc-600 transition group-hover:translate-x-1 group-hover:text-zinc-950 dark:bg-white/10 dark:text-zinc-300 dark:group-hover:text-white">
        <ArrowRight size={20} />
      </span>
    </Link>
  );
}

function RecentProject({
  project,
  featured,
}: {
  project: Project;
  featured: boolean;
}) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="group grid items-center gap-4 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 transition hover:border-emerald-400 hover:bg-white hover:shadow-sm dark:border-white/10 dark:bg-[#081216] dark:hover:border-emerald-500/50 dark:hover:bg-[#0b171c] sm:grid-cols-[220px_minmax(0,1fr)_auto]"
    >
      <div className="relative hidden aspect-[16/7] overflow-hidden rounded-md bg-[#071014] sm:block">
        <ProjectCoverImage
          className="size-full object-cover"
          project={project}
          decorative
        />
        {featured && (
          <span className="absolute bottom-2 right-2 rounded bg-zinc-950/75 px-2 py-1 text-[11px] font-medium text-white">
            Reciente
          </span>
        )}
      </div>
      <div className="min-w-0">
        <h3 className="truncate font-semibold">{project.name}</h3>
        <p className="mt-1 line-clamp-1 text-sm text-zinc-500 dark:text-zinc-400">
          {project.description || "Sin descripcion"}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <Files size={14} />
            {project._count?.mediaAssets || 0} archivos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ListChecks size={14} />
            {project._count?.jobs || 0} procesos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={14} />
            {formatDate(project.updatedAt)}
          </span>
        </div>
      </div>
      <span className="grid size-10 place-items-center rounded-md bg-zinc-100 text-zinc-500 transition group-hover:translate-x-1 group-hover:bg-emerald-100 group-hover:text-emerald-700 dark:bg-white/10 dark:text-zinc-300 dark:group-hover:bg-emerald-500/20 dark:group-hover:text-emerald-300">
        <ArrowRight size={20} />
      </span>
    </Link>
  );
}
