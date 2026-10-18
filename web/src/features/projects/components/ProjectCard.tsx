import { ArrowRight, Files, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate } from "../../../shared/lib/format";
import type { Project } from "../../../shared/types/domain";
import { ProjectCoverImage } from "./ProjectCoverImage";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="group overflow-hidden rounded-lg border border-zinc-200 bg-white transition hover:border-emerald-600 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500"
    >
      <div className="aspect-[16/7] overflow-hidden bg-zinc-100 dark:bg-[#081216]">
        <ProjectCoverImage
          className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
          project={project}
        />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-zinc-950 dark:text-white">
            {project.name}
          </h3>
          <ArrowRight
            className="text-zinc-400 transition group-hover:translate-x-1 group-hover:text-emerald-600"
            size={18}
          />
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
          {project.description || "Sin descripcion"}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <Files size={14} />
            {project._count?.mediaAssets || 0}
          </span>
          <span className="flex items-center gap-1">
            <ListChecks size={14} />
            {project._count?.jobs || 0}
          </span>
          <span className="ml-auto">{formatDate(project.updatedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
