import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import type { Project } from "../../../shared/types/domain";

export function useProjects() {
  const { api } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async (): Promise<Project[] | undefined> => {
    setLoading(true);
    try {
      const list = await api<Project[]>("/projects");
      setProjects(list);
      setError("");
      return list;
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { projects, loading, error, refresh };
}
