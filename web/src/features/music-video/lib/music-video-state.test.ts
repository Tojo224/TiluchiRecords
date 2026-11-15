import { describe, expect, it } from "vitest";
import type { Job, MediaAsset } from "@/shared/types/domain";
import { deriveMusicVideoState } from "./music-video-state";

function makeJob(overrides: Partial<Job> & Pick<Job, "id" | "type">): Job {
  return {
    projectId: "p1",
    status: "COMPLETED",
    progress: 100,
    payload: null,
    result: null,
    errorMessage: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeAsset(
  overrides: Partial<MediaAsset> & Pick<MediaAsset, "id" | "kind">,
): MediaAsset {
  return {
    projectId: "p1",
    name: overrides.id,
    origin: "GENERATED",
    status: "READY",
    mimeType: "video/mp4",
    storageKey: overrides.id,
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("deriveMusicVideoState", () => {
  it("returns an empty state without jobs or assets", () => {
    const state = deriveMusicVideoState(undefined, undefined, "");
    expect(state.analysis).toBeUndefined();
    expect(state.storyboard).toBeUndefined();
    expect(state.clips).toEqual([]);
    expect(state.finalVideo).toBeUndefined();
    expect(state.scenes).toEqual([]);
  });

  it("chains analysis, storyboard, clips, composition and final video", () => {
    const scenes = [{ sceneIndex: 1, startTime: 0, endTime: 5 }];
    const jobs = [
      makeJob({
        id: "a1",
        type: "ANALYZE_AUDIO",
        payload: { audioAssetId: "audio1" },
      }),
      makeJob({
        id: "s1",
        type: "GENERATE_STORYBOARD",
        payload: { analysisJobId: "a1" },
        result: { schemaVersion: "music-video-v2", scenes },
      }),
      makeJob({
        id: "c1",
        type: "GENERATE_VIDEO_CLIPS",
        payload: { storyboardJobId: "s1" },
      }),
      makeJob({
        id: "m1",
        type: "COMPOSE_VIDEOCLIP",
        payload: { audioAssetId: "audio1", clipJobId: "c1" },
      }),
    ];
    const assets = [
      makeAsset({
        id: "clip1",
        kind: "VIDEO_CLIP",
        metadata: { sourceJobId: "c1" },
      }),
      makeAsset({
        id: "final1",
        kind: "FINAL_VIDEOCLIP",
        metadata: { sourceJobId: "m1" },
      }),
    ];
    const state = deriveMusicVideoState(jobs, assets, "audio1");
    expect(state.analysis?.id).toBe("a1");
    expect(state.storyboard?.id).toBe("s1");
    expect(state.scenes).toHaveLength(1);
    expect(state.clips.map((clip) => clip.id)).toEqual(["clip1"]);
    expect(state.composeJob?.id).toBe("m1");
    expect(state.finalVideo?.id).toBe("final1");
  });

  it("ignores storyboards with another schema version", () => {
    const jobs = [
      makeJob({
        id: "a1",
        type: "ANALYZE_AUDIO",
        payload: { audioAssetId: "audio1" },
      }),
      makeJob({
        id: "s1",
        type: "GENERATE_STORYBOARD",
        payload: { analysisJobId: "a1" },
        result: { schemaVersion: "music-video-v1", scenes: [] },
      }),
    ];
    const state = deriveMusicVideoState(jobs, [], "audio1");
    expect(state.storyboardJob?.id).toBe("s1");
    expect(state.storyboard).toBeUndefined();
  });
});
