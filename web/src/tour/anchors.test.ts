import { afterEach, describe, expect, it } from "vitest";
import {
  TOUR_ANCHORS,
  findStepElement,
  findTourElement,
  tourAnchor,
  tourSelector,
} from "./anchors";

afterEach(() => {
  document.body.innerHTML = "";
});

/** jsdom has no layout: fake getClientRects for elements marked "hidden". */
function mount(html: string) {
  document.body.innerHTML = html;
  document.querySelectorAll<HTMLElement>("[data-tour]").forEach((element) => {
    const isHidden = element.dataset.fakeHidden === "true";
    element.getClientRects = () =>
      (isHidden ? [] : [new DOMRect(0, 0, 10, 10)]) as unknown as DOMRectList;
  });
}

describe("tour anchors", () => {
  it("builds selectors and JSX props from one name", () => {
    expect(tourSelector(TOUR_ANCHORS.newProject)).toBe(
      '[data-tour="new-project"]',
    );
    expect(tourAnchor(TOUR_ANCHORS.newProject)).toEqual({
      "data-tour": "new-project",
    });
  });

  it("uses unique anchor names", () => {
    const values = Object.values(TOUR_ANCHORS);
    expect(new Set(values).size).toBe(values.length);
  });

  it("returns the first visible match, skipping hidden duplicates", () => {
    mount(`
      <a id="desktop" data-tour="new-project" data-fake-hidden="true"></a>
      <a id="mobile" data-tour="new-project"></a>`);
    expect(findTourElement(TOUR_ANCHORS.newProject)?.id).toBe("mobile");
  });

  it("skips elements hidden with display none", () => {
    mount(`
      <a id="a" data-tour="new-project" style="display:none"></a>
      <a id="b" data-tour="new-project"></a>`);
    expect(findTourElement(TOUR_ANCHORS.newProject)?.id).toBe("b");
  });

  it("findStepElement prefers the target, then the fallback", () => {
    const step = {
      target: TOUR_ANCHORS.karaokeDropzone,
      fallbackTarget: TOUR_ANCHORS.karaokeUpload,
    };
    mount(`<div id="zone" data-tour="karaoke-dropzone"></div>
      <button id="btn" data-tour="karaoke-upload"></button>`);
    expect(findStepElement(step)?.id).toBe("zone");
    mount(`<div id="zone" data-tour="karaoke-dropzone" data-fake-hidden="true"></div>
      <button id="btn" data-tour="karaoke-upload"></button>`);
    expect(findStepElement(step)?.id).toBe("btn");
    mount("<p>nothing</p>");
    expect(findStepElement(step)).toBeNull();
    expect(
      findStepElement({ target: TOUR_ANCHORS.karaokeDropzone }),
    ).toBeNull();
  });

  it("returns null when missing or all duplicates are hidden", () => {
    mount("<p>nothing</p>");
    expect(findTourElement(TOUR_ANCHORS.newProject)).toBeNull();
    mount(`<a data-tour="new-project" data-fake-hidden="true"></a>`);
    expect(findTourElement(TOUR_ANCHORS.newProject)).toBeNull();
  });

  it("never throws on a broken root", () => {
    const broken = {
      querySelectorAll: () => {
        throw new Error("boom");
      },
    } as unknown as ParentNode;
    expect(findTourElement(TOUR_ANCHORS.newProject, broken)).toBeNull();
  });
});
