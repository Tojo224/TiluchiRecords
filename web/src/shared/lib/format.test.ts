import { describe, expect, it } from "vitest";
import { formatDuration } from "@/shared/lib/format";

describe("formatDuration", () => {
  it("formats seconds as m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(65)).toBe("1:05");
  });

  it("rounds fractional seconds", () => {
    expect(formatDuration(59.6)).toBe("1:00");
  });

  it("clamps negative values to zero", () => {
    expect(formatDuration(-10)).toBe("0:00");
  });

  it("keeps counting minutes past one hour", () => {
    expect(formatDuration(3661)).toBe("61:01");
  });
});
