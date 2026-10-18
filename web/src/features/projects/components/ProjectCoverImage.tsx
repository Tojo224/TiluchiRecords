import { useEffect, useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import type { Project } from "../../../shared/types/domain";

const DEFAULT_COVER = "/assets/dashboard-studio-hero.png";

export function ProjectCoverImage({
  project,
  className,
  decorative = false,
}: {
  project: Project;
  className?: string;
  decorative?: boolean;
}) {
  const { api } = useAuth();
  const [url, setUrl] = useState(DEFAULT_COVER);

  useEffect(() => {
    let active = true;
    setUrl(DEFAULT_COVER);
    if (!project.coverImage?.id) return;
    api<{ downloadUrl: string }>(`/media/${project.coverImage.id}/download-url`)
      .then(({ downloadUrl }) => {
        if (active) setUrl(downloadUrl);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [api, project.coverImage?.id]);

  return (
    <img
      className={className}
      src={url}
      alt={decorative ? "" : `Portada de ${project.name}`}
    />
  );
}
