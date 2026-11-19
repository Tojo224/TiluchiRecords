import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { driver, type PopoverDOM } from "driver.js";
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

const nameStep: TourStep = {
  ...step,
  target: TOUR_ANCHORS.projectName,
  late: true,
  focusTarget: true,
};
const submitStep: TourStep = {
  ...step,
  target: TOUR_ANCHORS.projectSubmit,
  late: true,
};

function addAnchorFor(name: string) {
  const element = document.createElement("div");
  element.setAttribute("data-tour", name);
  document.body.appendChild(element);
  return element;
}

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

  it("reports unavailable when the first anchor never appears", async () => {
    const onUnavailable = vi.fn();
    const onDestroy = vi.fn();
    runMicroTour([step], { onUnavailable, onDestroy, waitMs: 300 });
    await vi.advanceTimersByTimeAsync(500);
    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(onDestroy).toHaveBeenCalledTimes(1);
  });

  it("does not report unavailable when a step is shown", () => {
    addAnchor();
    const onUnavailable = vi.fn();
    runMicroTour([step], { onUnavailable });
    expect(drive).toHaveBeenCalledTimes(1);
    firstConfig()?.onDestroyed?.(undefined, {}, {} as never);
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it("stays silent for later steps that are missing", () => {
    addAnchor();
    const onUnavailable = vi.fn();
    const missing = { ...step, target: TOUR_ANCHORS.musicPlan };
    runMicroTour([step, missing], { onUnavailable });
    expect(firstConfig()?.steps).toHaveLength(1);
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it("does not report unavailable when disposed on purpose", async () => {
    const onUnavailable = vi.fn();
    const dispose = runMicroTour([step], { onUnavailable, waitMs: 300 });
    dispose();
    await vi.advanceTimersByTimeAsync(500);
    expect(onUnavailable).not.toHaveBeenCalled();
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

  describe("step guide block", () => {
    function popoverDom() {
      const wrapper = document.createElement("div");
      const description = document.createElement("div");
      const footer = document.createElement("div");
      wrapper.append(description, footer);
      document.body.appendChild(wrapper);
      return { wrapper, description, footer } as unknown as PopoverDOM;
    }

    function render(guided: TourStep, popover: PopoverDOM) {
      addAnchor();
      runMicroTour([guided]);
      const hook = firstConfig()?.steps?.[0]?.popover?.onPopoverRender;
      hook?.(popover, {} as never);
    }

    it("renders action and fields with DOM nodes and textContent", () => {
      const popover = popoverDom();
      render(
        {
          ...step,
          action: 'Pulsa "Subir video".',
          fields: [
            {
              label: "Campo",
              value: "<img src=x onerror=alert(1)>",
              required: true,
              note: "maximo 5",
            },
            { label: "Otro", value: "algo", required: false },
          ],
        },
        popover,
      );
      const guide = popover.wrapper.querySelector(".tiluchi-tour-guide");
      expect(guide?.textContent).toContain('Que hacer: Pulsa "Subir video".');
      expect(guide?.textContent).toContain("Obligatorio");
      expect(guide?.textContent).toContain("Opcional");
      expect(guide?.textContent).toContain("(maximo 5)");
      expect(guide?.querySelector("img")).toBeNull();
      expect(guide?.textContent).toContain("<img src=x");
      expect(popover.description.nextElementSibling).toBe(guide);
    });

    it("is idempotent when the popover re-renders and keeps the exit button", () => {
      const popover = popoverDom();
      const guided = { ...step, action: "Haz algo." };
      render(guided, popover);
      const hook = firstConfig()?.steps?.[0]?.popover?.onPopoverRender;
      hook?.(popover, {} as never);
      expect(
        popover.wrapper.querySelectorAll(".tiluchi-tour-guide"),
      ).toHaveLength(1);
      expect(popover.footer.querySelectorAll("[data-tour-exit]")).toHaveLength(
        1,
      );
    });

    it("renders nothing without action or fields", () => {
      const popover = popoverDom();
      render(step, popover);
      expect(popover.wrapper.querySelector(".tiluchi-tour-guide")).toBeNull();
      expect(popover.footer.querySelector("[data-tour-exit]")).not.toBeNull();
    });
  });

  describe("late steps (modal)", () => {
    const steps = [step, nameStep, submitStep];

    /** Drivers handed out in order, so handoffs can be told apart. */
    function twoDrivers() {
      const second = { drive: vi.fn(), destroy: vi.fn() };
      vi.mocked(driver)
        .mockReturnValueOnce({ drive, destroy } as never)
        .mockReturnValueOnce(second as never);
      return second;
    }

    it("shows only the visible part first", () => {
      addAnchor();
      runMicroTour(steps);
      expect(driver).toHaveBeenCalledTimes(1);
      expect(firstConfig()?.steps).toHaveLength(1);
    });

    it("waits for the modal after the click, then continues inside it", async () => {
      const second = twoDrivers();
      const onDestroy = vi.fn();
      const onUnavailable = vi.fn();
      addAnchor();
      runMicroTour(steps, { onDestroy, onUnavailable });

      document
        .querySelector("[data-tour]")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(destroy).toHaveBeenCalledTimes(1);
      // The replaced driver ending is a handoff, not the end of the tour.
      firstConfig()?.onDestroyed?.(undefined, {}, {} as never);
      expect(onDestroy).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(300);
      expect(driver).toHaveBeenCalledTimes(1);

      addAnchorFor(TOUR_ANCHORS.projectName);
      addAnchorFor(TOUR_ANCHORS.projectSubmit);
      await vi.advanceTimersByTimeAsync(150);

      expect(driver).toHaveBeenCalledTimes(2);
      expect(second.drive).toHaveBeenCalledTimes(1);
      const modalSteps = vi.mocked(driver).mock.calls[1][0]?.steps;
      expect(modalSteps).toHaveLength(2);
      expect(modalSteps?.[0]).toMatchObject({
        allowPageInteraction: true,
        focus: "element",
      });
      expect(modalSteps?.[1]).not.toHaveProperty("focus");
      expect(onUnavailable).not.toHaveBeenCalled();
      expect(onDestroy).not.toHaveBeenCalled();
    });

    it("ignores clicks outside the highlighted element", async () => {
      addAnchor();
      runMicroTour(steps);
      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(300);
      expect(destroy).not.toHaveBeenCalled();
    });

    it("ends quietly when the modal never opens", async () => {
      twoDrivers();
      const onDestroy = vi.fn();
      const onUnavailable = vi.fn();
      addAnchor();
      runMicroTour(steps, { onDestroy, onUnavailable });
      document
        .querySelector("[data-tour]")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(5000);
      expect(driver).toHaveBeenCalledTimes(1);
      expect(onDestroy).toHaveBeenCalledTimes(1);
      expect(onUnavailable).not.toHaveBeenCalled();
    });

    it("ends quietly when the modal closes before the user finishes", async () => {
      const second = twoDrivers();
      const onDestroy = vi.fn();
      const onUnavailable = vi.fn();
      addAnchor();
      runMicroTour(steps, { onDestroy, onUnavailable });
      document
        .querySelector("[data-tour]")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const modalName = addAnchorFor(TOUR_ANCHORS.projectName);
      addAnchorFor(TOUR_ANCHORS.projectSubmit);
      await vi.advanceTimersByTimeAsync(150);
      expect(second.drive).toHaveBeenCalledTimes(1);

      modalName.remove();
      await vi.advanceTimersByTimeAsync(250);
      expect(second.destroy).toHaveBeenCalledTimes(1);
      // driver.js reports the destruction through onDestroyed.
      vi.mocked(driver).mock.calls[1][0]?.onDestroyed?.(
        undefined,
        {},
        {} as never,
      );
      expect(onDestroy).toHaveBeenCalledTimes(1);
      expect(onUnavailable).not.toHaveBeenCalled();
      // No watcher left behind.
      await vi.advanceTimersByTimeAsync(1000);
      expect(second.destroy).toHaveBeenCalledTimes(1);
    });

    it("starts at the modal steps when the modal is already open", () => {
      addAnchor();
      addAnchorFor(TOUR_ANCHORS.projectName);
      addAnchorFor(TOUR_ANCHORS.projectSubmit);
      runMicroTour(steps);
      expect(driver).toHaveBeenCalledTimes(1);
      expect(firstConfig()?.steps).toHaveLength(2);
    });

    it("disposes cleanly while waiting for the modal and inside it", async () => {
      const second = twoDrivers();
      const onDestroy = vi.fn();
      addAnchor();
      const dispose = runMicroTour(steps, { onDestroy });
      document
        .querySelector("[data-tour]")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      dispose();
      addAnchorFor(TOUR_ANCHORS.projectName);
      await vi.advanceTimersByTimeAsync(500);
      expect(driver).toHaveBeenCalledTimes(1);
      expect(onDestroy).not.toHaveBeenCalled();
      expect(second.drive).not.toHaveBeenCalled();
    });

    it("disposing inside the modal destroys the driver and stops watching", async () => {
      const second = twoDrivers();
      addAnchor();
      const dispose = runMicroTour(steps);
      document
        .querySelector("[data-tour]")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      addAnchorFor(TOUR_ANCHORS.projectName);
      addAnchorFor(TOUR_ANCHORS.projectSubmit);
      await vi.advanceTimersByTimeAsync(150);
      dispose();
      expect(second.destroy).toHaveBeenCalledTimes(1);
      document.body.innerHTML = "";
      await vi.advanceTimersByTimeAsync(500);
      expect(second.destroy).toHaveBeenCalledTimes(1);
    });
  });
});
