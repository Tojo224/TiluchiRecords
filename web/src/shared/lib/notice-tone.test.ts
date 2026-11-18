import { describe, expect, it } from "vitest";
import { resolveNoticeTone } from "./notice-tone";

const status = (patch: Partial<Parameters<typeof resolveNoticeTone>[1]>) => ({
  failed: false,
  active: false,
  activeTone: "success" as const,
  ...patch,
});

describe("resolveNoticeTone", () => {
  it("uses the message tone when nothing is running or failed", () => {
    expect(resolveNoticeTone("success", status({}))).toBe("success");
    expect(resolveNoticeTone("error", status({}))).toBe("error");
  });

  it("uses the active tone while a job is running", () => {
    expect(resolveNoticeTone("error", status({ active: true }))).toBe(
      "success",
    );
    expect(
      resolveNoticeTone(
        "success",
        status({ active: true, activeTone: "info" }),
      ),
    ).toBe("info");
  });

  it("lets a failure win over everything", () => {
    expect(
      resolveNoticeTone("success", status({ failed: true, active: true })),
    ).toBe("error");
  });
});
