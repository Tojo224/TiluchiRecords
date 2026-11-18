import { describe, expect, it } from "vitest";
import { reconcileProgress } from "./progress";
import { EMPTY_TOUR_SNAPSHOT, type TourSnapshot } from "./snapshot";
import { DEFAULT_TOUR_PROGRESS, type TourProgress } from "./storage";

const base: TourProgress = { ...DEFAULT_TOUR_PROGRESS, completed: [] };
const snap = (patch: Partial<TourSnapshot>): TourSnapshot => ({
  ...EMPTY_TOUR_SNAPSHOT,
  ...patch,
});

describe("reconcileProgress", () => {
  it("records existing work silently on the full baseline", () => {
    const result = reconcileProgress(
      base,
      snap({ projectCount: 2, videoCount: 1 }),
      { baseline: "all" },
    );
    expect(result.progress.completed).toEqual([
      "create-project",
      "upload-video",
    ]);
    expect(result.newlyCompleted).toEqual([]);
  });

  it("silences only project-derived missions on the project baseline", () => {
    const result = reconcileProgress(
      base,
      snap({ projectCount: 1, videoCount: 1, audioCount: 1 }),
      { baseline: "project" },
    );
    expect(result.progress.completed).toEqual([
      "create-project",
      "upload-video",
      "upload-music",
    ]);
    expect(result.newlyCompleted).toEqual(["create-project"]);
  });

  it("reports newly completed missions after the baseline", () => {
    const result = reconcileProgress(base, snap({ projectCount: 1 }), {
      baseline: "none",
    });
    expect(result.progress.completed).toEqual(["create-project"]);
    expect(result.newlyCompleted).toEqual(["create-project"]);
  });

  it("is idempotent and keeps the same object when nothing changed", () => {
    const first = reconcileProgress(base, snap({ projectCount: 1 }), {
      baseline: "none",
    });
    const second = reconcileProgress(
      first.progress,
      snap({ projectCount: 1 }),
      { baseline: "none" },
    );
    expect(second.progress).toBe(first.progress);
    expect(second.newlyCompleted).toEqual([]);
  });

  it("never un-completes a mission", () => {
    const done: TourProgress = { ...base, completed: ["upload-video"] };
    const result = reconcileProgress(done, EMPTY_TOUR_SNAPSHOT, {
      baseline: "none",
    });
    expect(result.progress.completed).toEqual(["upload-video"]);
    expect(result.newlyCompleted).toEqual([]);
  });
});
