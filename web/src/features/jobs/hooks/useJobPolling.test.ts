import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJobPolling } from "@/features/jobs/hooks/useJobPolling";
import { useActiveJobPolling } from "@/features/jobs/hooks/useActiveJobPolling";

describe("useJobPolling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("polls at the baseline interval when no jobs are active", () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useJobPolling({ refresh, active: false }));
    act(() => vi.advanceTimersByTime(2999));
    expect(refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("polls at the fast interval while jobs are active", () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useJobPolling({ refresh, active: true }));
    act(() => vi.advanceTimersByTime(3000));
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("switches interval without leaving duplicate timers", () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ active }) => useJobPolling({ refresh, active }),
      { initialProps: { active: true } },
    );
    expect(vi.getTimerCount()).toBe(1);
    rerender({ active: false });
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(3000));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("clears the timer on unmount", () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() =>
      useJobPolling({ refresh, active: true }),
    );
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(10000));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("swallows refresh failures", async () => {
    const refresh = vi.fn().mockRejectedValue(new Error("network"));
    renderHook(() => useJobPolling({ refresh, active: false }));
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("useActiveJobPolling", () => {
  it("retains only while active and releases when inactive or unmounted", () => {
    const release = vi.fn();
    const retain = vi.fn(() => release);
    const { rerender, unmount } = renderHook(
      ({ active }) => useActiveJobPolling(retain, active),
      { initialProps: { active: false } },
    );
    expect(retain).not.toHaveBeenCalled();
    rerender({ active: true });
    expect(retain).toHaveBeenCalledTimes(1);
    rerender({ active: false });
    expect(release).toHaveBeenCalledTimes(1);
    rerender({ active: true });
    unmount();
    expect(retain).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledTimes(2);
  });
});
