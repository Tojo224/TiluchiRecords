import { describe, expect, it } from "vitest";
import type {
  Job,
  MediaAsset,
  MediaAssetKind,
  Project,
} from "@/shared/types/domain";
import {
  EMPTY_TOUR_SNAPSHOT,
  mergeSnapshot,
  sameSnapshot,
  snapshotFromProject,
} from "./snapshot";

function asset(
  id: string,
  kind: MediaAssetKind,
  overrides: Partial<MediaAsset> = {},
): MediaAsset {
  return {
    id,
    projectId: "p1",
    name: id,
    origin: "UPLOADED",
    status: "READY",
    kind,
    mimeType: "video/mp4",
    storageKey: id,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function job(overrides: Partial<Job> & Pick<Job, "id" | "type">): Job {
  return {
    projectId: "p1",
    status: "COMPLETED",
    progress: 100,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "Demo",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("snapshotFromProject", () => {
  it("counts only READY uploaded originals", () => {
    const snap = snapshotFromProject(
      project({
        mediaAssets: [
          asset("v1", "ORIGINAL_VIDEO"),
          asset("v2", "ORIGINAL_VIDEO", { status: "UPLOADING" }),
          asset("v3", "ORIGINAL_VIDEO", { origin: "GENERATED" }),
          asset("a1", "ORIGINAL_AUDIO"),
          asset("i1", "FACE_SWAP_SOURCE_IMAGE"),
        ],
      }),
    );
    expect(snap).toMatchObject({
      videoCount: 1,
      audioCount: 1,
      imageCount: 1,
      karaokeReady: false,
      storyboardReady: false,
    });
  });

  it("detects karaoke, performance, face swap and final video", () => {
    const snap = snapshotFromProject(
      project({
        mediaAssets: [
          asset("k", "KARAOKE_VIDEO", { origin: "GENERATED" }),
          asset("p1", "KARAOKE_PERFORMANCE_VIDEO"),
          asset("p2", "KARAOKE_PERFORMANCE_VIDEO"),
          asset("f", "FACE_SWAP_RESULT_VIDEO", { origin: "GENERATED" }),
          asset("fv", "FINAL_VIDEOCLIP", { origin: "GENERATED" }),
        ],
      }),
    );
    expect(snap).toMatchObject({
      karaokeReady: true,
      performanceCount: 2,
      faceSwapResultCount: 1,
      finalVideoReady: true,
    });
  });

  it("detects a storyboard tied to an uploaded audio", () => {
    const snap = snapshotFromProject(
      project({
        mediaAssets: [asset("a1", "ORIGINAL_AUDIO")],
        jobs: [
          job({
            id: "an",
            type: "ANALYZE_AUDIO",
            payload: { audioAssetId: "a1" },
          }),
          job({
            id: "sb",
            type: "GENERATE_STORYBOARD",
            payload: { analysisJobId: "an" },
            result: { schemaVersion: "music-video-v2", scenes: [] },
          }),
        ],
      }),
    );
    expect(snap.storyboardReady).toBe(true);
  });

  it("handles a project without assets or jobs", () => {
    const { projectCount, ...projectScoped } = EMPTY_TOUR_SNAPSHOT;
    expect(projectCount).toBe(0);
    expect(snapshotFromProject(project())).toEqual(projectScoped);
  });
});

describe("merge and equality", () => {
  it("merges a partial patch without mutating the base", () => {
    const merged = mergeSnapshot(EMPTY_TOUR_SNAPSHOT, { videoCount: 2 });
    expect(merged.videoCount).toBe(2);
    expect(EMPTY_TOUR_SNAPSHOT.videoCount).toBe(0);
  });

  it("compares snapshots by value", () => {
    const a = mergeSnapshot(EMPTY_TOUR_SNAPSHOT, { audioCount: 1 });
    const b = mergeSnapshot(EMPTY_TOUR_SNAPSHOT, { audioCount: 1 });
    expect(sameSnapshot(a, b)).toBe(true);
    expect(sameSnapshot(a, mergeSnapshot(b, { karaokeReady: true }))).toBe(
      false,
    );
  });
});
