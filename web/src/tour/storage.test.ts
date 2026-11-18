import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TOUR_PROGRESS,
  loadProgress,
  parseProgress,
  resetProgress,
  saveProgress,
  serializeProgress,
  tourStorageKey,
} from "./storage";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const sample = {
  version: 1 as const,
  welcomed: true,
  dismissed: false,
  completed: ["create-project"],
};

describe("parse/serialize", () => {
  it("round-trips valid progress", () => {
    expect(parseProgress(serializeProgress(sample))).toEqual(sample);
  });

  it("returns defaults for null, corrupt JSON, wrong shape or version", () => {
    for (const raw of [
      null,
      "",
      "{not json",
      "42",
      "null",
      JSON.stringify({ ...sample, version: 2 }),
      JSON.stringify({ ...sample, welcomed: "yes" }),
      JSON.stringify({ ...sample, completed: "x" }),
    ]) {
      expect(parseProgress(raw)).toEqual(DEFAULT_TOUR_PROGRESS);
    }
  });

  it("drops non-string completed ids and never shares the default array", () => {
    const parsed = parseProgress(
      JSON.stringify({ ...sample, completed: ["a", 1, null] }),
    );
    expect(parsed.completed).toEqual(["a"]);
    parseProgress(null).completed.push("x");
    expect(DEFAULT_TOUR_PROGRESS.completed).toEqual([]);
  });
});

describe("storage I/O", () => {
  it("scopes the key per user with an anonymous fallback", () => {
    expect(tourStorageKey("u1")).toBe("tiluchi_tour_v1:u1");
    expect(tourStorageKey(null)).toBe("tiluchi_tour_v1:anonymous");
    expect(tourStorageKey(undefined)).toBe("tiluchi_tour_v1:anonymous");
  });

  it("saves, loads per user, and resets", () => {
    saveProgress("u1", sample);
    expect(loadProgress("u1")).toEqual(sample);
    expect(loadProgress("u2")).toEqual(DEFAULT_TOUR_PROGRESS);
    resetProgress("u1");
    expect(loadProgress("u1")).toEqual(DEFAULT_TOUR_PROGRESS);
  });

  it("survives a throwing localStorage", () => {
    const boom = () => {
      throw new Error("denied");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom);
    expect(loadProgress("u1")).toEqual(DEFAULT_TOUR_PROGRESS);
    expect(() => saveProgress("u1", sample)).not.toThrow();
    expect(() => resetProgress("u1")).not.toThrow();
  });
});
