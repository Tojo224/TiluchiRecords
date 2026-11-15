import { describe, expect, it } from "vitest";
import type { StoryboardScene } from "@/shared/types/domain";
import {
  clipStageLabel,
  formatTimelineTime,
  friendlySceneDescription,
  intensityLabel,
  scenePhase,
  shotTypeLabel,
} from "./scene-labels";

function makeScene(overrides: Partial<StoryboardScene> = {}): StoryboardScene {
  return {
    sceneIndex: 1,
    startTime: 0,
    endTime: 10,
    description: "Una idea visual. Escena 2 de 5",
    ...overrides,
  };
}

describe("scenePhase", () => {
  it("labels first, last, second to last and middle scenes", () => {
    expect(scenePhase(0, 5)).toBe("Apertura");
    expect(scenePhase(4, 5)).toBe("Cierre");
    expect(scenePhase(3, 5)).toBe("Punto alto");
    expect(scenePhase(1, 5)).toBe("Desarrollo");
  });

  it("does not use Punto alto for short storyboards", () => {
    expect(scenePhase(0, 2)).toBe("Apertura");
    expect(scenePhase(1, 2)).toBe("Cierre");
  });
});

describe("formatTimelineTime", () => {
  it("formats seconds as mm:ss", () => {
    expect(formatTimelineTime(0)).toBe("00:00");
    expect(formatTimelineTime(65.4)).toBe("01:05");
  });

  it("clamps negative and invalid values to zero", () => {
    expect(formatTimelineTime(-5)).toBe("00:00");
    expect(formatTimelineTime(Number.NaN)).toBe("00:00");
  });
});

describe("friendlySceneDescription", () => {
  it("keeps the description when the scene has a title", () => {
    const scene = makeScene({ title: "Intro", description: "Texto" });
    expect(friendlySceneDescription(scene, 0, 3)).toBe("Texto");
  });

  it("builds a phase based description without a title", () => {
    expect(friendlySceneDescription(makeScene(), 0, 5)).toBe(
      "Presenta el ambiente y la idea principal. Concepto: Una idea visual.",
    );
    expect(friendlySceneDescription(makeScene(), 4, 5)).toBe(
      "Cierra la secuencia y resuelve la idea visual. Concepto: Una idea visual.",
    );
  });
});

describe("intensityLabel", () => {
  it("prefers the scene intensity", () => {
    expect(intensityLabel(makeScene({ intensity: "alta" }), 0, 3)).toBe(
      "Intensidad: alta",
    );
  });

  it("falls back to the phase", () => {
    expect(intensityLabel(makeScene(), 0, 5)).toBe("Intensidad: suave");
    expect(intensityLabel(makeScene(), 3, 5)).toBe("Intensidad: alta");
    expect(intensityLabel(makeScene(), 4, 5)).toBe("Intensidad: final");
    expect(intensityLabel(makeScene(), 1, 5)).toBe("Intensidad: media");
  });
});

describe("shotTypeLabel", () => {
  it("maps shot types to Spanish labels", () => {
    expect(shotTypeLabel("PERFORMANCE")).toBe("Interpretacion");
    expect(shotTypeLabel("ESTABLISHING")).toBe("Ambiente");
    expect(shotTypeLabel("NARRATIVE")).toBe("Narrativa");
  });
});

describe("clipStageLabel", () => {
  it("appends the scene position when known", () => {
    expect(clipStageLabel("keyframes", 2, 6)).toBe(
      "Creando escenas y fondos - escena 2 de 6",
    );
    expect(clipStageLabel("animation")).toBe("Generando movimiento");
  });

  it("handles encoding and unknown stages", () => {
    expect(clipStageLabel("encoding", 1, 2)).toBe("Codificando clips");
    expect(clipStageLabel(undefined)).toBe("Preparando videoclip");
  });
});
