import { useEffect } from "react";

export const BASELINE_POLL_INTERVAL_MS = 3000;
export const ACTIVE_POLL_INTERVAL_MS = 1000;

type UseJobPollingOptions = {
  refresh: () => Promise<void>;
  /** True while at least one job the UI cares about is PENDING or PROCESSING. */
  active: boolean;
  baselineIntervalMs?: number;
  activeIntervalMs?: number;
};

/**
 * Owns the single polling timer for project data: fast while jobs are active,
 * baseline otherwise. Only one timer exists at any time and it is cleared on
 * unmount or whenever the interval changes.
 */
export function useJobPolling({
  refresh,
  active,
  baselineIntervalMs = BASELINE_POLL_INTERVAL_MS,
  activeIntervalMs = ACTIVE_POLL_INTERVAL_MS,
}: UseJobPollingOptions) {
  const intervalMs = active ? activeIntervalMs : baselineIntervalMs;
  useEffect(() => {
    const interval = window.setInterval(
      () => refresh().catch(() => undefined),
      intervalMs,
    );
    return () => window.clearInterval(interval);
  }, [refresh, intervalMs]);
}
