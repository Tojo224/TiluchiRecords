import { describe, expect, it } from "vitest";
import projectsPage from "../features/projects/pages/ProjectsPage.tsx?raw";
import newProjectModal from "../features/projects/components/NewProjectModal.tsx?raw";
import karaokePage from "../features/karaoke/pages/KaraokePage.tsx?raw";
import singingModal from "../features/karaoke/components/KaraokeSingingModal.tsx?raw";
import musicPage from "../features/music-video/pages/MusicVideoPage.tsx?raw";
import phaseTwoPanel from "../features/music-video/components/PhaseTwoPanel.tsx?raw";
import consentPanel from "../features/face-swap/components/ConsentPanel.tsx?raw";
import disabledReason from "../components/ui/DisabledReason.tsx?raw";
import { UI_LABELS, type UiLabelKey } from "./ui-labels";

/** Lowercase, strip accents and collapse whitespace (JSX wraps long text). */
const normalize = (text: string): string =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");

/**
 * True when the label is a whole string literal or JSX text node, not just a
 * substring of something longer (e.g. "cantar" inside "comenzar a cantar").
 */
function isRenderedText(source: string, label: string): boolean {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const quote = "[>\"'`]";
  const end = "(?:[<\"'`{]|$)";
  return new RegExp(`${quote}\\s*${escaped}\\s*${end}`).test(source);
}

/**
 * Labels that are only the start of a longer rendered text (a sentence or a
 * heading with extra words). Everything else is a button or field label and
 * must match as a whole string/text node.
 */
const PARTIAL_LABELS: ReadonlySet<UiLabelKey> = new Set<UiLabelKey>([
  "suggestedStyles",
  "consentText",
  "missingPrefix",
]);

/**
 * Where each tour label is rendered. If this test fails, a UI label was
 * renamed: update UI_LABELS (and the tour copy that uses it) to match.
 */
const RENDERED_IN: Record<UiLabelKey, Record<string, string>> = {
  newProject: { "ProjectsPage.tsx": projectsPage },
  createProject: { "NewProjectModal.tsx": newProjectModal },
  projectName: { "NewProjectModal.tsx": newProjectModal },
  projectDescription: { "NewProjectModal.tsx": newProjectModal },
  uploadVideo: { "KaraokePage.tsx": karaokePage },
  createKaraoke: { "KaraokePage.tsx": karaokePage },
  sing: { "KaraokePage.tsx": karaokePage },
  startSinging: { "KaraokeSingingModal.tsx": singingModal },
  saveRecording: { "KaraokeSingingModal.tsx": singingModal },
  uploadMusic: { "MusicVideoPage.tsx": musicPage },
  analyzePlan: { "MusicVideoPage.tsx": musicPage },
  produceVideoclip: { "PhaseTwoPanel.tsx": phaseTwoPanel },
  startSwap: { "ConsentPanel.tsx": consentPanel },
  visualDirection: { "MusicVideoPage.tsx": musicPage },
  suggestedStyles: { "MusicVideoPage.tsx": musicPage },
  consentPanel: { "ConsentPanel.tsx": consentPanel },
  consentText: { "ConsentPanel.tsx": consentPanel },
  missingPrefix: { "DisabledReason.tsx": disabledReason },
};

describe("UI label drift guard", () => {
  it("maps every label to the file that renders it", () => {
    expect(Object.keys(RENDERED_IN).sort()).toEqual(
      Object.keys(UI_LABELS).sort(),
    );
  });

  it.each(Object.keys(UI_LABELS) as UiLabelKey[])(
    "label %s is still rendered by its component",
    (key) => {
      const label = normalize(UI_LABELS[key]);
      for (const [file, source] of Object.entries(RENDERED_IN[key])) {
        expect(
          PARTIAL_LABELS.has(key)
            ? normalize(source).includes(label)
            : isRenderedText(normalize(source), label),
          `UI label "${UI_LABELS[key]}" (${key}) not found in ${file}: update UI_LABELS and the tour copy`,
        ).toBe(true);
      }
    },
  );
});
