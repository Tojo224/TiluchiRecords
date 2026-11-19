import {
  driver,
  type DriveStep,
  type Driver,
  type PopoverDOM,
} from "driver.js";
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

const GUIDE_ATTR = "data-tour-guide";

/**
 * Appends the "what to do" block (action + fields) under the description.
 * Built with DOM APIs and textContent only, so step data is never parsed as
 * HTML. Idempotent: a previous block is removed before adding a new one.
 */
export function renderStepGuide(popover: PopoverDOM, step: TourStep): void {
  popover.description.parentElement
    ?.querySelectorAll(`[${GUIDE_ATTR}]`)
    .forEach((node) => node.remove());
  if (!step.action && !step.fields?.length) return;

  const guide = document.createElement("div");
  guide.setAttribute(GUIDE_ATTR, "true");
  guide.className = "tiluchi-tour-guide";

  if (step.action) {
    const action = document.createElement("p");
    action.className = "tiluchi-tour-action";
    const label = document.createElement("strong");
    label.textContent = "Que hacer: ";
    action.append(label, document.createTextNode(step.action));
    guide.appendChild(action);
  }

  if (step.fields?.length) {
    const list = document.createElement("ul");
    list.className = "tiluchi-tour-fields";
    for (const field of step.fields) {
      const item = document.createElement("li");
      const name = document.createElement("strong");
      name.textContent = field.label;
      const badge = document.createElement("span");
      badge.className = field.required
        ? "tiluchi-tour-badge tiluchi-tour-badge-required"
        : "tiluchi-tour-badge";
      badge.textContent = field.required ? "Obligatorio" : "Opcional";
      const value = document.createElement("span");
      value.className = "tiluchi-tour-field-value";
      value.textContent = field.note
        ? `${field.value} (${field.note})`
        : field.value;
      item.append(name, " ", badge, document.createElement("br"), value);
      list.appendChild(item);
    }
    guide.appendChild(list);
  }

  popover.description.insertAdjacentElement("afterend", guide);
}

function toDriveSteps(
  steps: readonly TourStep[],
  onRender: (popover: PopoverDOM, step: TourStep) => void,
): DriveStep[] {
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
          // A per-step hook REPLACES the global one in driver.js, so the
          // runner passes everything through a single callback.
          onPopoverRender: (popover) => onRender(popover, step),
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

  function addExitButton(popover: PopoverDOM) {
    if (popover.footer.querySelector("[data-tour-exit]")) return;
    const exit = document.createElement("button");
    exit.type = "button";
    exit.textContent = "Salir de la guia";
    exit.setAttribute("data-tour-exit", "true");
    exit.className = "tiluchi-tour-exit";
    exit.addEventListener("click", closeTour);
    popover.footer.appendChild(exit);
  }

  function start() {
    try {
      const driveSteps = toDriveSteps(steps, (popover, step) => {
        renderStepGuide(popover, step);
        addExitButton(popover);
      });
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
