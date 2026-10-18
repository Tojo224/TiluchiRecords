import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Panel } from "../../../components/ui/Panel";
import { formatDate } from "../../../shared/lib/format";
import { useProject } from "../../projects/context/ProjectContext";

export function JobsPage() {
  const { project, refresh } = useProject();
  const { api } = useAuth();
  const [error, setError] = useState("");
  async function retry(id: string) {
    try {
      await api(`/jobs/${id}/retry`, { method: "POST" });
      await refresh();
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <>
      <PageHeader title="Procesos" description={project.name} />
      <Notice message={error} tone="error" />
      <Panel>
        {project.jobs?.length ? (
          <div className="grid gap-3">
            {project.jobs.map((job) => (
              <article
                key={job.id}
                className="grid gap-3 border-b border-zinc-200 pb-4 last:border-0 dark:border-zinc-800 md:grid-cols-[1fr_2fr_auto] md:items-center"
              >
                <div>
                  <strong className="block text-sm">{job.type}</strong>
                  <span className="text-xs text-zinc-500">
                    {job.status} · {formatDate(job.updatedAt)}
                  </span>
                  {job.errorMessage && (
                    <p className="mt-1 text-xs text-red-600">
                      {job.errorMessage}
                    </p>
                  )}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-full bg-emerald-600"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
                {job.status === "FAILED" ? (
                  <Button variant="secondary" onClick={() => retry(job.id)}>
                    <RefreshCw size={16} />
                    Reintentar
                  </Button>
                ) : (
                  <b className="text-sm">{job.progress}%</b>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-zinc-500">
            No hay procesos.
          </p>
        )}
      </Panel>
    </>
  );
}
