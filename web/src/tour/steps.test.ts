import { describe, expect, it } from "vitest";
import modalSource from "../features/karaoke/components/KaraokeSingingModal.tsx?raw";
import { TOUR_ANCHORS } from "./anchors";
import { UI_LABELS } from "./ui-labels";
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
    expect(targets("create-project")).toEqual([
      "new-project",
      "project-name",
      "project-description",
      "project-submit",
    ]);
    expect(targets("create-plan")).toEqual(["music-prompt", "music-plan"]);
    expect(targets("face-swap")).toEqual([
      "face-swap-image-dropzone",
      "face-swap-video-dropzone",
      "face-swap-people",
      "face-swap-consent",
      "face-swap-run",
    ]);
    expect(targets("upload-video")).toEqual(["karaoke-dropzone"]);
    expect(targets("upload-music")).toEqual(["music-dropzone"]);
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

  it("tells the user what to do in every step", () => {
    for (const step of allSteps) {
      expect(Boolean(step.action) || Boolean(step.fields?.length)).toBe(true);
      for (const field of step.fields ?? []) {
        expect(field.label.length).toBeGreaterThan(0);
        expect(field.value.length).toBeGreaterThan(0);
        expect(typeof field.required).toBe("boolean");
      }
    }
  });

  it("describes the prompt field with its real label and limit", () => {
    const [prompt] = stepsForMission("create-plan");
    expect(prompt.fields?.[0]).toMatchObject({
      label: UI_LABELS.visualDirection,
      required: true,
    });
    expect(prompt.fields?.[0].note).toMatch(/500/);
    expect(prompt.fields?.[0].value).toContain(UI_LABELS.suggestedStyles);
  });

  it("guides the create-project modal with fields and the submit button", () => {
    const [open, name, description, submit] = stepsForMission("create-project");
    expect(open.late).toBeUndefined();
    expect(open.action).toContain(UI_LABELS.newProject);
    for (const step of [name, description, submit])
      expect(step.late).toBe(true);
    expect(name.fields?.[0]).toMatchObject({
      label: UI_LABELS.projectName,
      required: true,
    });
    expect(name.fields?.[0].note).toMatch(/100/);
    expect(description.fields?.[0]).toMatchObject({
      label: UI_LABELS.projectDescription,
      required: false,
    });
    expect(description.fields?.[0].note).toMatch(/500/);
    expect(submit.action).toContain(UI_LABELS.createProject);
    expect(submit.fields).toBeUndefined();
    for (const step of [name, description, submit]) {
      const copy = [
        step.action ?? "",
        ...(step.fields ?? []).flatMap((f) => [f.label, f.value, f.note ?? ""]),
      ].join("");
      expect(copy).toMatch(/^[ -~]*$/);
    }
  });

  it("explains the singing modal flow in text", () => {
    const [sing] = stepsForMission("sing-karaoke");
    for (const text of [
      UI_LABELS.startSinging,
      "microfono",
      UI_LABELS.saveRecording,
    ]) {
      expect(sing.description).toContain(text);
    }
  });

  it("points to the Falta line on steps with a blockable button", () => {
    for (const id of [
      "create-karaoke",
      "create-plan",
      "generate-videoclip",
      "face-swap",
    ]) {
      const blocked = stepsForMission(id).filter((s) =>
        /boton esta desactivado/.test(s.description),
      );
      expect(blocked.length).toBeGreaterThan(0);
      for (const step of blocked) {
        expect(step.description).toContain(UI_LABELS.missingPrefix);
      }
    }
  });

  it("tries the dropzone first and falls back to a registered button", () => {
    const withFallback = allSteps.filter((step) => step.fallbackTarget);
    expect(withFallback.map((step) => step.fallbackTarget)).toEqual([
      "karaoke-upload",
      "music-upload",
      "face-swap-image-button",
      "face-swap-video-button",
    ]);
    for (const step of withFallback) {
      expect(anchorNames).toContain(step.fallbackTarget);
      expect(step.fallbackTarget).not.toBe(step.target);
      expect(step.target).toMatch(/dropzone$/);
      expect(step.action).toMatch(/^Arrastra .* o pulsa /);
    }
  });

  it("guides the face swap prerequisites in page order", () => {
    const [image, video, people, consent, run] = stepsForMission("face-swap");
    expect(image.action).toContain(UI_LABELS.uploadImage);
    expect(image.action).toContain(UI_LABELS.changeImage);
    expect(video.action).toContain(UI_LABELS.uploadVideo);
    expect(video.action).toContain(UI_LABELS.changeVideo);
    expect(people.title).toContain(UI_LABELS.peopleToReplace);
    expect(people.description).toMatch(/termina la deteccion/);
    expect(people.description).toMatch(/una sola persona, se selecciona sola/);
    expect(people.late).toBeUndefined();
    expect(consent.fields?.[0].required).toBe(true);
    expect(run.action).toContain(UI_LABELS.startSwap);
    expect(run.description).toContain(UI_LABELS.startSwapMany);
  });

  it("returns an empty list for unknown missions", () => {
    expect(stepsForMission("unknown")).toEqual([]);
  });
});
