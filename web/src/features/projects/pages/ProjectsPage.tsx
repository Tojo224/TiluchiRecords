import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { PageHeader } from "../../../components/ui/PageHeader";
import { NewProjectModal } from "../components/NewProjectModal";
import { ProjectCard } from "../components/ProjectCard";
import { useProjects } from "../hooks/useProjects";

export function ProjectsPage() {
  const { projects, loading, error } = useProjects();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader
        title="Proyectos"
        description="Todas tus producciones en un solo lugar."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} />
            Nuevo proyecto
          </Button>
        }
      />
      <Notice message={error} tone="error" />
      {loading ? (
        <p className="text-sm text-zinc-500">Cargando proyectos...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
      {creating && <NewProjectModal onClose={() => setCreating(false)} />}
    </>
  );
}
