import { describe, expect, it } from "vitest";
import {
  MISSIONS,
  completedMissionIds,
  missionProgress,
  nextMission,
} from "./missions";
import { EMPTY_TOUR_SNAPSHOT, mergeSnapshot } from "./snapshot";

describe("missions", () => {
  it("keeps the agreed order with face swap as the only optional one", () => {
    expect(MISSIONS.map((mission) => mission.id)).toEqual([
      "create-project",
      "upload-video",
      "create-karaoke",
      "sing-karaoke",
      "upload-music",
      "create-plan",
      "generate-videoclip",
      "face-swap",
    ]);
    expect(MISSIONS.filter((mission) => mission.optional)).toHaveLength(1);
  });

  it("has unique ids and non-empty accent-free copy", () => {
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    for (const mission of MISSIONS) {
      expect(mission.title && mission.why && mission.doneToast).toBeTruthy();
      expect(`${mission.title}${mission.why}${mission.doneToast}`).toMatch(
        /^[\x20-\x7E]+$/,
      );
    }
  });

  it("gives every mission an accent-free next hint that names a button", () => {
    for (const mission of MISSIONS) {
      expect(mission.nextHint).toMatch(/^[\x20-\x7E]+$/);
      expect(mission.nextHint).toMatch(/"[^"]+"/);
    }
  });

  it("detects nothing on an empty snapshot", () => {
    expect(completedMissionIds(EMPTY_TOUR_SNAPSHOT)).toEqual([]);
  });

  it("detects each mission from its own signal", () => {
    const cases: [string, Partial<typeof EMPTY_TOUR_SNAPSHOT>][] = [
      ["create-project", { projectCount: 1 }],
      ["upload-video", { videoCount: 1 }],
      ["create-karaoke", { karaokeReady: true }],
      ["sing-karaoke", { performanceCount: 1 }],
      ["upload-music", { audioCount: 1 }],
      ["create-plan", { storyboardReady: true }],
      ["generate-videoclip", { finalVideoReady: true }],
      ["face-swap", { faceSwapResultCount: 1 }],
    ];
    for (const [id, patch] of cases) {
      expect(
        completedMissionIds(mergeSnapshot(EMPTY_TOUR_SNAPSHOT, patch)),
      ).toEqual([id]);
    }
  });

  it("returns the next core mission, then the optional one, then null", () => {
    expect(nextMission([])?.id).toBe("create-project");
    expect(nextMission(["create-project", "upload-video"])?.id).toBe(
      "create-karaoke",
    );
    const core = MISSIONS.filter((m) => !m.optional).map((m) => m.id);
    expect(nextMission(core)?.id).toBe("face-swap");
    expect(nextMission(MISSIONS.map((m) => m.id))).toBeNull();
  });

  it("reports progress over core missions only", () => {
    expect(missionProgress([])).toEqual({ done: 0, total: 7 });
    expect(missionProgress(["create-project", "face-swap"])).toEqual({
      done: 1,
      total: 7,
    });
  });

  it("builds project routes only when a project id is known", () => {
    const karaoke = MISSIONS.find((m) => m.id === "create-karaoke");
    expect(karaoke?.route()).toBeNull();
    expect(karaoke?.route("p1")).toBe("/projects/p1/karaoke");
    expect(MISSIONS[0].route()).toBe("/projects");
  });
});
