import { describe, expect, it } from "vitest";
import modalSource from "../features/karaoke/components/KaraokeSingingModal.tsx?raw";
import { TOUR_ANCHORS } from "./anchors";
import { MISSIONS } from "./missions";
import {
  MISSION_STEPS,
  MISSION_UNAVAILABLE_HINTS,
  TOUR_UNAVAILABLE_MESSAGE,
  stepsForMission,
} from "./steps";

const anchorNames = Object.values(TOUR_ANCHORS) as string[];
const allSteps = Object.values(MISSION_STEPS).flat();

describe("mission steps", () => {
  it("covers every mission and no unknown mission", () => {
    const missionIds = MISSIONS.map((mission) => mission.id).sort();
    expect(Object.keys(MISSION_STEPS).sort()).toEqual(missionIds);
  });

  it("targets only registered anchors", () => {
    for (const step of allSteps) {
      expect(anchorNames).toContain(step.target);
    }
  });

  it("maps missions to the expected anchors", () => {
    const targets = (id: string) =>
      stepsForMission(id).map((step) => step.target);
    expect(targets("create-project")).toEqual(["new-project"]);
    expect(targets("create-plan")).toEqual(["music-prompt", "music-plan"]);
    expect(targets("face-swap")).toEqual([
      "face-swap-consent",
      "face-swap-run",
    ]);
  });

  it("uses ASCII-only copy and keeps every step interactive", () => {
    for (const step of allSteps) {
      expect(`${step.title}${step.description}`).toMatch(/^[\x20-\x7E]+$/);
      expect(step.interactive).toBe(true);
    }
  });

  it("keeps the unavailable copy ASCII-only and tied to real missions", () => {
    expect(TOUR_UNAVAILABLE_MESSAGE).toMatch(/^[\x20-\x7E]+$/);
    for (const [id, hint] of Object.entries(MISSION_UNAVAILABLE_HINTS)) {
      expect(Object.keys(MISSION_STEPS)).toContain(id);
      expect(hint).toMatch(/^[\x20-\x7E]+$/);
    }
  });

  it("never calls the mandatory visual direction optional", () => {
    const prompt = allSteps.filter((step) => step.target === "music-prompt");
    expect(prompt.length).toBeGreaterThan(0);
    for (const step of prompt) {
      expect(step.description).not.toMatch(/opcional/i);
      expect(step.description).toMatch(/obligatoria/i);
    }
  });

  it("never targets anything inside the singing modal", () => {
    expect(modalSource).not.toContain("data-tour");
    expect(modalSource).not.toContain("tourAnchor");
  });

  it("returns an empty list for unknown missions", () => {
    expect(stepsForMission("unknown")).toEqual([]);
  });
});
