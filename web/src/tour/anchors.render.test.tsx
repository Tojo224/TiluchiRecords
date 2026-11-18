import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/Button";
import { FileUpload } from "@/features/media/components/FileUpload";
import { MediaPlayer } from "@/features/media/components/MediaPlayer";
import type { MediaAsset } from "@/shared/types/domain";
import { TOUR_ANCHORS, tourAnchor, tourSelector } from "./anchors";

const asset: MediaAsset = {
  id: "a1",
  projectId: "p1",
  name: "karaoke.mp4",
  origin: "GENERATED",
  status: "READY",
  kind: "KARAOKE_VIDEO",
  mimeType: "video/mp4",
  storageKey: "k",
  createdAt: "2026-01-01T00:00:00Z",
};

describe("data-tour reaches the DOM", () => {
  it("through Button", () => {
    render(<Button {...tourAnchor(TOUR_ANCHORS.newProject)}>Nuevo</Button>);
    const match = document.querySelector(tourSelector(TOUR_ANCHORS.newProject));
    expect(match?.tagName).toBe("BUTTON");
  });

  it("through FileUpload anchor", () => {
    render(
      <FileUpload
        accept="video/mp4"
        anchor={TOUR_ANCHORS.karaokeUpload}
        onSelect={async () => undefined}
      />,
    );
    const match = document.querySelector(
      tourSelector(TOUR_ANCHORS.karaokeUpload),
    );
    expect(match?.tagName).toBe("BUTTON");
  });

  it("through MediaPlayer action anchor", () => {
    render(
      <MediaPlayer
        title="Karaoke"
        asset={asset}
        onDownload={() => undefined}
        action={{
          label: "Cantar",
          onClick: () => undefined,
          anchor: TOUR_ANCHORS.karaokeSing,
        }}
      />,
    );
    const match = document.querySelector(
      tourSelector(TOUR_ANCHORS.karaokeSing),
    );
    expect(match).toHaveTextContent("Cantar");
  });
});
