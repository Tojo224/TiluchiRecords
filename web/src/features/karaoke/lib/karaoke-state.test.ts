import { describe, expect, it } from "vitest";
import { BUSY_REASON } from "@/shared/lib/blockers";
import { getKaraokeBlockers } from "./karaoke-state";

describe("getKaraokeBlockers", () => {
  it("returns no blockers when a video is selected and nothing runs", () => {
    expect(getKaraokeBlockers({ hasVideo: true, busy: false })).toEqual([]);
  });

  it("asks for a video when none is selected", () => {
    expect(getKaraokeBlockers({ hasVideo: false, busy: false })).toEqual([
      "subir o seleccionar un video con musica",
    ]);
  });

  it("reports a running process", () => {
    expect(getKaraokeBlockers({ hasVideo: true, busy: true })).toEqual([
      BUSY_REASON,
    ]);
  });

  it("lists every unmet requirement", () => {
    expect(getKaraokeBlockers({ hasVideo: false, busy: true })).toHaveLength(2);
  });
});
