/** Single source of truth for `data-tour` anchor names. */
export const TOUR_ANCHORS = {
  newProject: "new-project",
  projectName: "project-name",
  projectDescription: "project-description",
  projectSubmit: "project-submit",
  karaokeUpload: "karaoke-upload",
  karaokeDropzone: "karaoke-dropzone",
  karaokeCreate: "karaoke-create",
  karaokeSing: "karaoke-sing",
  musicUpload: "music-upload",
  musicDropzone: "music-dropzone",
  musicPrompt: "music-prompt",
  musicPlan: "music-plan",
  musicProduce: "music-produce",
  faceSwapImageDropzone: "face-swap-image-dropzone",
  faceSwapImageButton: "face-swap-image-button",
  faceSwapVideoDropzone: "face-swap-video-dropzone",
  faceSwapVideoButton: "face-swap-video-button",
  faceSwapPeople: "face-swap-people",
  faceSwapConsent: "face-swap-consent",
  faceSwapRun: "face-swap-run",
} as const;

export type TourAnchorName = (typeof TOUR_ANCHORS)[keyof typeof TOUR_ANCHORS];

export function tourSelector(name: TourAnchorName): string {
  return `[data-tour="${name}"]`;
}

/** Props to spread onto a JSX element to mark it as a tour anchor. */
export function tourAnchor(name: TourAnchorName): { "data-tour": string } {
  return { "data-tour": name };
}

function isVisible(element: Element): boolean {
  if (element.getClientRects().length === 0) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

/**
 * Returns the first VISIBLE element carrying the anchor. Some regions are
 * duplicated in the DOM (desktop sidebar + mobile drawer), so the first match
 * is not always the one the user can see. Never throws.
 */
export function findTourElement(
  name: TourAnchorName,
  root: ParentNode = document,
): Element | null {
  try {
    const matches = Array.from(root.querySelectorAll(tourSelector(name)));
    return matches.find(isVisible) ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves the element a step points at: the first visible match of its
 * primary anchor, else of its optional fallback anchor (for example the
 * empty-state dropzone first, the header button once a file exists).
 */
export function findStepElement(step: {
  target: TourAnchorName;
  fallbackTarget?: TourAnchorName;
}): Element | null {
  return (
    findTourElement(step.target) ??
    (step.fallbackTarget ? findTourElement(step.fallbackTarget) : null)
  );
}
