import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  getJobFlags,
  resolveJobForType,
  selectJobForType,
  useJobForType,
} from "@/features/jobs/hooks/useJobForType";
import type { Job } from "@/shared/types/domain";

function makeJob(overrides: Partial<Job> & Pick<Job, "id">): Job {
  return {
    projectId: "p1",
    type: "GENERATE_KARAOKE",
    status: "PENDING",
    progress: 0,
    payload: null,
    result: null,
    errorMessage: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("selectJobForType", () => {
  it("returns undefined when there are no jobs", () => {
    expect(selectJobForType(undefined, "GENERATE_KARAOKE")).toBeUndefined();
    expect(selectJobForType([], "GENERATE_KARAOKE")).toBeUndefined();
  });

  it("ignores jobs of other types", () => {
    const jobs = [makeJob({ id: "a", type: "FACE_SWAP" })];
    expect(selectJobForType(jobs, "GENERATE_KARAOKE")).toBeUndefined();
  });

  it("picks the first job in list order when several share a type", () => {
    const jobs = [makeJob({ id: "first" }), makeJob({ id: "second" })];
    expect(selectJobForType(jobs, "GENERATE_KARAOKE")?.id).toBe("first");
  });

  it("applies the payload matcher", () => {
    const jobs = [
      makeJob({ id: "a", payload: { videoAssetId: "v1" } }),
      makeJob({ id: "b", payload: { videoAssetId: "v2" } }),
    ];
    const match = selectJobForType(
      jobs,
      "GENERATE_KARAOKE",
      (job) => job.payload?.videoAssetId === "v2",
    );
    expect(match?.id).toBe("b");
  });

  it("returns undefined when the matcher rejects every job", () => {
    const jobs = [makeJob({ id: "a", payload: { videoAssetId: "v1" } })];
    expect(
      selectJobForType(jobs, "GENERATE_KARAOKE", () => false),
    ).toBeUndefined();
  });
});

describe("getJobFlags", () => {
  it("is all false without a job", () => {
    expect(getJobFlags(undefined)).toEqual({
      running: false,
      failed: false,
      completed: false,
    });
  });

  it.each([
    ["PENDING", { running: true, failed: false, completed: false }],
    ["PROCESSING", { running: true, failed: false, completed: false }],
    ["FAILED", { running: false, failed: true, completed: false }],
    ["COMPLETED", { running: false, failed: false, completed: true }],
    ["WAITING_USER", { running: false, failed: false, completed: false }],
    ["CANCELLED", { running: false, failed: false, completed: false }],
  ] as const)("maps %s", (status, expected) => {
    expect(getJobFlags(makeJob({ id: "a", status }))).toEqual(expected);
  });
});

describe("resolveJobForType / useJobForType", () => {
  it("returns the job together with its flags", () => {
    const job = makeJob({ id: "a", status: "PROCESSING" });
    expect(resolveJobForType([job], "GENERATE_KARAOKE")).toEqual({
      job,
      running: true,
      failed: false,
      completed: false,
    });
  });

  it("hook returns the same result as the pure resolver", () => {
    const job = makeJob({ id: "a", status: "FAILED" });
    const { result } = renderHook(() =>
      useJobForType([job], "GENERATE_KARAOKE"),
    );
    expect(result.current.job).toBe(job);
    expect(result.current.failed).toBe(true);
    expect(result.current.running).toBe(false);
  });
});
