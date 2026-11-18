import { describe, expect, it } from "vitest";
import { MISSIONS } from "@/tour/missions";
import { HELP_SECTIONS } from "./help-content";

function allCopy(): string[] {
  return HELP_SECTIONS.flatMap((section) => [
    section.id,
    section.title,
    section.summary,
    ...section.steps,
    ...(section.tips ?? []),
    ...(section.troubleshooting ?? []).flatMap((item) => [
      item.problem,
      item.solution,
    ]),
  ]);
}

describe("help content", () => {
  it("has unique, url-safe section ids", () => {
    const ids = HELP_SECTIONS.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9-]+$/));
  });

  it("covers every flow of the manual", () => {
    expect(HELP_SECTIONS.map((section) => section.title)).toEqual([
      "Primeros pasos",
      "Karaoke",
      "Video desde musica",
      "Face swap",
      "Archivos y Resultados",
      "Procesos y tiempos de espera",
      "Problemas frecuentes",
    ]);
  });

  it("references only existing tour missions", () => {
    const missionIds = MISSIONS.map((mission) => mission.id);
    HELP_SECTIONS.filter((section) => section.missionId).forEach((section) =>
      expect(missionIds).toContain(section.missionId),
    );
  });

  it("gives every section a summary and at least one step", () => {
    HELP_SECTIONS.forEach((section) => {
      expect(section.summary.length).toBeGreaterThan(0);
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });

  it("has no empty troubleshooting entries", () => {
    HELP_SECTIONS.flatMap((section) => section.troubleshooting ?? []).forEach(
      (item) => {
        expect(item.problem.trim()).not.toBe("");
        expect(item.solution.trim()).not.toBe("");
      },
    );
  });

  it("keeps the copy ASCII-only (no accents, project convention)", () => {
    allCopy().forEach((text) => expect(text).toMatch(/^[\x20-\x7e]*$/));
  });
});
