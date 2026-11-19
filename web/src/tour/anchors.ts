/** Single source of truth for `data-tour` anchor names. */
export const TOUR_ANCHORS = {
  newProject: "new-project",
  projectFlows: "project-flows",
  projectName: "project-name",
  projectDescription: "project-description",
  projectSubmit: "project-submit",
  karaokeUpload: "karaoke-upload",
  karaokeCreate: "karaoke-create",
  karaokeSing: "karaoke-sing",
  musicUpload: "music-upload",
  musicPrompt: "music-prompt",
  musicPlan: "music-plan",
  musicProduce: "music-produce",
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
