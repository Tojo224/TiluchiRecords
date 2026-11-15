import { describe, expect, it } from "vitest";
import { formatVideoDuration, sameIdentitySelection } from "./face-swap-state";

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
