import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { findTourElement } from "./anchors";
import type { TourStep } from "./steps";

export type RunMicroTourOptions = {
  /** Called once when the tour ends by itself (done, exit, Esc or no anchor). */
  onDestroy?: () => void;
  /**
   * Called (right before onDestroy) when the tour ended WITHOUT showing any
   * step, e.g. the first anchor never appeared. Not called when disposed.
   */
  onUnavailable?: () => void;
  /** How long to wait for the first anchor to appear. */
  waitMs?: number;
};

const POLL_MS = 100;
const DEFAULT_WAIT_MS = 2500;

export function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

function toDriveSteps(steps: readonly TourStep[]): DriveStep[] {
  return steps.flatMap((step): DriveStep[] => {
    const element = findTourElement(step.target);
    // Later steps whose element is not on screen yet are skipped silently.
    if (!element) return [];
    return [
      {
        element,
        allowPageInteraction: step.interactive,
        popover: {
          title: step.title,
          description: step.description,
          side: step.side,
        },
      },
    ];
  });
}

/**
 * Runs a micro-tour with driver.js. Elements are resolved lazily (first
 * VISIBLE anchor). If the first anchor never shows up the tour finishes
 * and reports it through onUnavailable. Returns a disposer that is safe to call any number of times.
 */
export function runMicroTour(
  steps: readonly TourStep[],
  options: RunMicroTourOptions = {},
): () => void {
  const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
  let disposed = false;
  let finished = false;
  let instance: Driver | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    closeTour();
  };

  function cleanup() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    document.removeEventListener("keydown", onKeyDown, true);
  }

  function finish(unavailable = false) {
    if (finished) return;
    finished = true;
    cleanup();
    if (disposed) return;
    if (unavailable) options.onUnavailable?.();
    options.onDestroy?.();
  }

  function closeTour() {
    if (!instance) return;
    try {
      instance.destroy();
    } catch {
      finish();
    }
  }

  function start() {
    try {
      const driveSteps = toDriveSteps(steps);
      if (driveSteps.length === 0) {
        finish(true);
        return;
      }
      const reduced = prefersReducedMotion();
      instance = driver({
        steps: driveSteps,
        animate: !reduced,
        smoothScroll: !reduced,
        showProgress: driveSteps.length > 1,
        progressText: "{{current}} de {{total}}",
        nextBtnText: "Siguiente",
        prevBtnText: "Anterior",
        doneBtnText: "Listo",
        closeBtnLabel: "Salir de la guia",
        showButtons: ["next", "previous", "close"],
        allowClose: true,
        allowKeyboardControl: false,
        overlayClickBehavior: "none",
        popoverClass: "tiluchi-tour-popover",
        onPopoverRender: (popover) => {
          if (popover.footer.querySelector("[data-tour-exit]")) return;
          const exit = document.createElement("button");
          exit.type = "button";
          exit.textContent = "Salir de la guia";
          exit.setAttribute("data-tour-exit", "true");
          exit.className = "tiluchi-tour-exit";
          exit.addEventListener("click", closeTour);
          popover.footer.appendChild(exit);
        },
        onDestroyed: () => finish(),
      });
      document.addEventListener("keydown", onKeyDown, true);
      instance.drive();
    } catch {
      // A broken tour must never block the UI.
      finish();
    }
  }

  function waitForFirstAnchor(attemptsLeft: number) {
    if (disposed) return;
    if (!steps.length) {
      finish(true);
      return;
    }
    if (findTourElement(steps[0].target)) {
      start();
      return;
    }
    if (attemptsLeft <= 0) {
      finish(true);
      return;
    }
    timer = setTimeout(() => waitForFirstAnchor(attemptsLeft - 1), POLL_MS);
  }

  waitForFirstAnchor(Math.ceil(waitMs / POLL_MS));

  return () => {
    if (disposed) return;
    disposed = true;
    const alreadyFinished = finished;
    cleanup();
    finished = true;
    if (instance && !alreadyFinished) {
      try {
        instance.destroy();
      } catch {
        // Already torn down by the library; nothing left to release.
      }
    }
  };
}
