import { useEffect } from "react";

/**
 * Requests fast polling while `active` is true. `retain` registers the
 * request with the project polling timer and returns a release function.
 */
export function useActiveJobPolling(retain: () => () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    return retain();
  }, [active, retain]);
}
