import { describe, expect, it } from "vitest";
import { BUSY_REASON } from "@/shared/lib/blockers";
import {
  formatVideoDuration,
  getFaceSwapBlockers,
  sameIdentitySelection,
  type FaceSwapBlockerInput,
} from "./face-swap-state";

const ready: FaceSwapBlockerInput = {
  hasImage: true,
  hasVideo: true,
  busy: false,
  analysisRunning: false,
  swapRunning: false,
  identityCount: 2,
  selectedCount: 1,
  consent: true,
};

describe("getFaceSwapBlockers", () => {
  it("returns no blockers when everything is ready", () => {
    expect(getFaceSwapBlockers(ready)).toEqual([]);
  });

  it("lists the missing image, video and consent", () => {
    expect(
      getFaceSwapBlockers({
        ...ready,
        hasImage: false,
        hasVideo: false,
        consent: false,
      }),
    ).toEqual([
      "subir o seleccionar una imagen",
      "subir o seleccionar un video",
      "aceptar la confirmacion",
    ]);
  });

  it("distinguishes waiting for detection from choosing a person", () => {
    const waiting = getFaceSwapBlockers({
      ...ready,
      identityCount: 0,
      selectedCount: 0,
    });
    const choosing = getFaceSwapBlockers({ ...ready, selectedCount: 0 });
    expect(waiting).toEqual([
      "esperar la deteccion de personas y elegir a quien reemplazar",
    ]);
    expect(choosing).toEqual(["elegir al menos una persona a reemplazar"]);
  });

  it("reports a single busy reason for any running process", () => {
    for (const key of ["busy", "analysisRunning", "swapRunning"] as const) {
      expect(getFaceSwapBlockers({ ...ready, [key]: true })).toEqual([
        BUSY_REASON,
      ]);
    }
  });

  it("blocks exactly when the legacy disabled condition did", () => {
    const flags = [false, true];
    for (const hasImage of flags)
      for (const hasVideo of flags)
        for (const busy of flags)
          for (const analysisRunning of flags)
            for (const swapRunning of flags)
              for (const selectedCount of [0, 1])
                for (const consent of flags) {
                  const input = {
                    ...ready,
                    hasImage,
                    hasVideo,
                    busy,
                    analysisRunning,
                    swapRunning,
                    selectedCount,
                    consent,
                  };
                  const legacy =
                    busy ||
                    analysisRunning ||
                    swapRunning ||
                    !hasImage ||
                    !hasVideo ||
                    selectedCount === 0 ||
                    !consent;
                  expect(getFaceSwapBlockers(input).length > 0).toBe(legacy);
                }
  });
});

describe("formatVideoDuration", () => {
  it("returns the placeholder when the duration is unknown", () => {
    expect(formatVideoDuration(0)).toBe("Duracion por detectar");
  });

  it("uses m:ss below one hour", () => {
    expect(formatVideoDuration(65)).toBe("1:05");
    expect(formatVideoDuration(3599)).toBe("59:59");
  });

  it("uses h:mm:ss from one hour onwards", () => {
    expect(formatVideoDuration(3600)).toBe("1:00:00");
    expect(formatVideoDuration(3725)).toBe("1:02:05");
  });

  it("rounds fractional seconds", () => {
    expect(formatVideoDuration(59.6)).toBe("1:00");
  });
});

describe("sameIdentitySelection", () => {
  it("is true for the same ids regardless of order", () => {
    expect(sameIdentitySelection(["a", "b"], ["b", "a"])).toBe(true);
  });

  it("is true for two empty selections", () => {
    expect(sameIdentitySelection([], [])).toBe(true);
  });

  it("is false when lengths differ", () => {
    expect(sameIdentitySelection(["a"], ["a", "b"])).toBe(false);
  });

  it("is false when ids differ", () => {
    expect(sameIdentitySelection(["a", "b"], ["a", "c"])).toBe(false);
  });

  it("does not mutate its inputs", () => {
    const left = ["b", "a"];
    const right = ["a", "b"];
    sameIdentitySelection(left, right);
    expect(left).toEqual(["b", "a"]);
    expect(right).toEqual(["a", "b"]);
  });
});
