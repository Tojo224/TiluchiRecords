import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { driver } from "driver.js";
import { TOUR_ANCHORS } from "./anchors";
import type { TourStep } from "./steps";
import { runMicroTour as run, type RunMicroTourOptions } from "./tourRunner";

vi.mock("driver.js", () => ({ driver: vi.fn() }));
vi.mock("driver.js/dist/driver.css", () => ({}));

const step: TourStep = {
  target: TOUR_ANCHORS.newProject,
  title: "Titulo",
  description: "Descripcion",
  side: "bottom",
  interactive: true,
};

const disposers: Array<() => void> = [];

function runMicroTour(steps: TourStep[], options?: RunMicroTourOptions) {
  const dispose = run(steps, options);
  disposers.push(dispose);
  return dispose;
}

const drive = vi.fn();
const destroy = vi.fn();

function addAnchor() {
  const button = document.createElement("button");
  button.setAttribute("data-tour", TOUR_ANCHORS.newProject);
  document.body.appendChild(button);
}

function setReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: reduced,
  }) as unknown as typeof window.matchMedia;
}

function firstConfig() {
  return vi.mocked(driver).mock.calls[0][0];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(driver).mockReturnValue({ drive, destroy } as never);
  // jsdom has no layout: report one client rect so elements count as visible.
  vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([
    {} as DOMRect,
  ] as unknown as DOMRectList);
  setReducedMotion(false);
});

afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(driver).mockReset();
  drive.mockReset();
  destroy.mockReset();
  document.body.innerHTML = "";
});

describe("runMicroTour", () => {
  it("starts driver.js with safe, Spanish options", () => {
    addAnchor();
    runMicroTour([step]);
    expect(firstConfig()).toMatchObject({
      allowKeyboardControl: false,
      overlayClickBehavior: "none",
      nextBtnText: "Siguiente",
      prevBtnText: "Anterior",
      doneBtnText: "Listo",
      animate: true,
    });
    expect(drive).toHaveBeenCalledTimes(1);
  });

  it("disables animation under prefers-reduced-motion", () => {
    setReducedMotion(true);
    addAnchor();
    runMicroTour([step]);
    expect(firstConfig()).toMatchObject({
      animate: false,
      smoothScroll: false,
    });
  });

  it("finishes silently when the first anchor never appears", async () => {
    const onDestroy = vi.fn();
    runMicroTour([step], { onDestroy, waitMs: 300 });
    await vi.advanceTimersByTimeAsync(500);
    expect(driver).not.toHaveBeenCalled();
    expect(onDestroy).toHaveBeenCalledTimes(1);
  });

  it("starts once a late anchor shows up", async () => {
    runMicroTour([step], { waitMs: 1000 });
    await vi.advanceTimersByTimeAsync(250);
    addAnchor();
    await vi.advanceTimersByTimeAsync(150);
    expect(drive).toHaveBeenCalledTimes(1);
  });

  it("disposer destroys once even if destroy throws", () => {
    addAnchor();
    destroy.mockImplementation(() => {
      throw new Error("boom");
    });
    const dispose = runMicroTour([step]);
    expect(() => dispose()).not.toThrow();
    dispose();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and reports the end once", () => {
    addAnchor();
    const onDestroy = vi.fn();
    runMicroTour([step], { onDestroy });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(destroy).toHaveBeenCalledTimes(1);
    const config = firstConfig();
    config?.onDestroyed?.(undefined, {}, {} as never);
    config?.onDestroyed?.(undefined, {}, {} as never);
    expect(onDestroy).toHaveBeenCalledTimes(1);
  });

  it("does not call onDestroy when disposed on purpose", () => {
    addAnchor();
    const onDestroy = vi.fn();
    const dispose = runMicroTour([step], { onDestroy });
    dispose();
    firstConfig()?.onDestroyed?.(undefined, {}, {} as never);
    expect(onDestroy).not.toHaveBeenCalled();
  });
});
