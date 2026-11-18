export type TourProgress = {
  version: 1;
  welcomed: boolean;
  dismissed: boolean;
  completed: string[];
};

export const DEFAULT_TOUR_PROGRESS: TourProgress = {
  version: 1,
  welcomed: false,
  dismissed: false,
  completed: [],
};

export function tourStorageKey(userId?: string | null): string {
  return `tiluchi_tour_v1:${userId || "anonymous"}`;
}

function defaults(): TourProgress {
  return { ...DEFAULT_TOUR_PROGRESS, completed: [] };
}

/** Pure: tolerates null, corrupt JSON, wrong shape and wrong version. */
export function parseProgress(raw: string | null): TourProgress {
  if (!raw) return defaults();
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return defaults();
    const record = value as Record<string, unknown>;
    if (
      record.version !== 1 ||
      typeof record.welcomed !== "boolean" ||
      typeof record.dismissed !== "boolean" ||
      !Array.isArray(record.completed)
    ) {
      return defaults();
    }
    return {
      version: 1,
      welcomed: record.welcomed,
      dismissed: record.dismissed,
      completed: record.completed.filter(
        (id): id is string => typeof id === "string",
      ),
    };
  } catch {
    return defaults();
  }
}

export function serializeProgress(progress: TourProgress): string {
  return JSON.stringify(progress);
}

export function loadProgress(userId?: string | null): TourProgress {
  try {
    return parseProgress(localStorage.getItem(tourStorageKey(userId)));
  } catch {
    return defaults();
  }
}

export function saveProgress(
  userId: string | null | undefined,
  progress: TourProgress,
): void {
  try {
    localStorage.setItem(tourStorageKey(userId), serializeProgress(progress));
  } catch {
    // Storage unavailable (private mode, quota): progress stays in memory.
  }
}

export function resetProgress(userId?: string | null): void {
  try {
    localStorage.removeItem(tourStorageKey(userId));
  } catch {
    // Nothing to reset when storage is unavailable.
  }
}
