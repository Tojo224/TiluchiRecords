import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MediaAsset, Project } from "@/shared/types/domain";
import { TourProjectBridge } from "./TourProjectBridge";
import { TourContext, type TourContextValue } from "./useTour";

const projectRef = vi.hoisted(() => ({ current: null as Project | null }));
vi.mock("../features/projects/context/ProjectContext", () => ({
  useProject: () => ({ project: projectRef.current }),
}));

function video(id: string): MediaAsset {
  return {
    id,
    projectId: "p1",
    name: id,
    origin: "UPLOADED",
    status: "READY",
    kind: "ORIGINAL_VIDEO",
    mimeType: "video/mp4",
    storageKey: id,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

function makeProject(assets: MediaAsset[]): Project {
  return {
    id: "p1",
    name: "P",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    mediaAssets: assets,
    jobs: [],
  };
}

function tree(reportProject: TourContextValue["reportProject"]) {
  return (
    <TourContext.Provider
      value={{ reportProject } as unknown as TourContextValue}
    >
      <TourProjectBridge />
    </TourContext.Provider>
  );
}

describe("TourProjectBridge", () => {
  it("reports only when the snapshot changes", () => {
    const report = vi.fn();
    projectRef.current = makeProject([video("v1")]);
    const view = render(tree(report));
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0][0]).toMatchObject({
      projectId: "p1",
      snapshot: { videoCount: 1 },
    });

    // Polling returns a new object with the same content: no new report.
    projectRef.current = makeProject([video("v1")]);
    view.rerender(tree(report));
    expect(report).toHaveBeenCalledTimes(1);

    projectRef.current = makeProject([video("v1"), video("v2")]);
    view.rerender(tree(report));
    expect(report).toHaveBeenCalledTimes(2);
    expect(report.mock.calls[1][0].snapshot.videoCount).toBe(2);
  });

  it("clears the report on unmount", () => {
    const report = vi.fn();
    projectRef.current = makeProject([]);
    render(tree(report)).unmount();
    expect(report).toHaveBeenLastCalledWith(null);
  });
});
