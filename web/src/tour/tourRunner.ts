import {
  driver,
  type DriveStep,
  type Driver,
  type PopoverDOM,
} from "driver.js";
import "driver.js/dist/driver.css";
import { findStepElement } from "./anchors";
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
/** How long to wait for a late area (a modal) after the user opens it. */
const LATE_WAIT_MS = 4000;

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
    const element = findStepElement(step);
    // Later steps whose element is not on screen yet are skipped silently.
    if (!element) return [];
    return [
      {
        element,
        allowPageInteraction: step.interactive,
        // Keep the keyboard on the field (and out of the popover) so typing
        // is never interrupted and a modal focus trap is not fought.
        ...(step.focusTarget ? { focus: "element" as const } : {}),
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
 * Splits steps into segments. A `late` step starts a new segment: its element
 * only exists after the user acts on the previous step (e.g. a modal), so each
 * segment is its own driver.js run.
 */
function toSegments(steps: readonly TourStep[]): TourStep[][] {
  const segments: TourStep[][] = [];
  steps.forEach((step, index) => {
    if (index === 0 || (step.late && !steps[index - 1].late)) {
      segments.push([step]);
    } else {
      segments[segments.length - 1].push(step);
    }
  });
  return segments;
}

/**
 * Runs a micro-tour with driver.js. Elements are resolved lazily (first
 * VISIBLE anchor). If the first anchor never shows up the tour finishes
 * and reports it through onUnavailable. Steps marked `late` continue the tour
 * once the user clicks the previous step's element and their anchor appears
 * (a modal, say); if that never happens, or that area closes, the tour ends
 * quietly. If a late area is already on screen at start, the tour begins
 * there. Returns a disposer that is safe to call any number of times.
 */
export function runMicroTour(
  steps: readonly TourStep[],
  options: RunMicroTourOptions = {},
): () => void {
  const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
  const segments = toSegments(steps);
  let disposed = false;
  let finished = false;
  let instance: Driver | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let detachClick: (() => void) | undefined;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    closeTour();
  };

  function cleanup() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    detachClick?.();
    detachClick = undefined;
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

  /** Polls until find() returns a segment index, or gives up. */
  function waitThen(
    attemptsLeft: number,
    find: () => number,
    onTimeout: () => void,
  ) {
    if (disposed || finished) return;
    const found = find();
    if (found >= 0) {
      startSegment(found);
      return;
    }
    if (attemptsLeft <= 0) {
      onTimeout();
      return;
    }
    timer = setTimeout(
      () => waitThen(attemptsLeft - 1, find, onTimeout),
      POLL_MS,
    );
  }

  /** When the user clicks `element` (last of a segment), wait for the next. */
  function armHandoff(index: number, element: Element) {
    const onClick = (event: Event) => {
      if (!(event.target instanceof Node) || !element.contains(event.target)) {
        return;
      }
      detachClick?.();
      detachClick = undefined;
      const previous = instance;
      // Detach first so the old driver's onDestroyed is not the tour's end.
      instance = null;
      try {
        previous?.destroy();
      } catch {
        // Already torn down by the library.
      }
      const next = segments[index + 1];
      waitThen(
        Math.ceil(LATE_WAIT_MS / POLL_MS),
        () => (findStepElement(next[0]) ? index + 1 : -1),
        () => finish(),
      );
    };
    document.addEventListener("click", onClick, true);
    detachClick = () => document.removeEventListener("click", onClick, true);
  }

  /** Ends the tour quietly when the area of a late segment goes away. */
  function watchScope(sentinel: TourStep) {
    const tick = () => {
      if (disposed || finished) return;
      if (!findStepElement(sentinel)) {
        closeTour();
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
  }

  function startSegment(index: number) {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    try {
      const segment = segments[index];
      const driveSteps = toDriveSteps(segment, (popover, step) => {
        renderStepGuide(popover, step);
        addExitButton(popover);
      });
      if (driveSteps.length === 0) {
        finish(index === 0);
        return;
      }
      const reduced = prefersReducedMotion();
      const current: Driver = driver({
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
        // A handed-off (replaced) driver must not end the whole tour.
        onDestroyed: () => {
          if (instance === current) finish();
        },
      });
      instance = current;
      document.addEventListener("keydown", onKeyDown, true);
      current.drive();
      if (index > 0) watchScope(segment[0]);
      const last = driveSteps[driveSteps.length - 1].element;
      if (index < segments.length - 1 && last instanceof Element) {
        armHandoff(index, last);
      }
    } catch {
      // A broken tour must never block the UI.
      finish();
    }
  }

  if (!segments.length) {
    finish(true);
  } else {
    waitThen(
      Math.ceil(waitMs / POLL_MS),
      // The latest area already on screen wins (e.g. the modal is open).
      () => {
        for (let i = segments.length - 1; i >= 0; i--) {
          if (findStepElement(segments[i][0])) return i;
        }
        return -1;
      },
      () => finish(true),
    );
  }

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
