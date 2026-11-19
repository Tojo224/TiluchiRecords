import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/Button";
import { FileUpload } from "@/features/media/components/FileUpload";
import { MediaPlayer } from "@/features/media/components/MediaPlayer";
import { IdentityGrid } from "@/features/face-swap/components/IdentityGrid";
import { SourceImagePanel } from "@/features/face-swap/components/SourceImagePanel";
import { TargetVideoPanel } from "@/features/face-swap/components/TargetVideoPanel";
import { NewProjectModal } from "@/features/projects/components/NewProjectModal";
import type { MediaAsset } from "@/shared/types/domain";
import { TOUR_ANCHORS, tourAnchor, tourSelector } from "./anchors";

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ api: vi.fn() }),
}));
vi.mock("../app/providers/AuthProvider", () => ({
  useAuth: () => ({ api: vi.fn() }),
}));

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

  it("through FileUpload dropzone anchor", () => {
    render(
      <FileUpload
        mode="dropzone"
        accept="video/mp4"
        anchor={TOUR_ANCHORS.karaokeDropzone}
        onSelect={async () => undefined}
      />,
    );
    const match = document.querySelector(
      tourSelector(TOUR_ANCHORS.karaokeDropzone),
    );
    expect(match?.tagName).toBe("DIV");
  });

  it("through the face swap panels: dropzone when empty, button when filled", () => {
    const common = {
      assetUrls: {},
      disabled: false,
      onUpload: async () => undefined,
    };
    const find = (name: (typeof TOUR_ANCHORS)[keyof typeof TOUR_ANCHORS]) =>
      document.querySelector(tourSelector(name));
    const image: MediaAsset = {
      ...asset,
      id: "i1",
      kind: "FACE_SWAP_SOURCE_IMAGE",
    };
    const video: MediaAsset = { ...asset, id: "v1", kind: "ORIGINAL_VIDEO" };

    const emptyImage = render(
      <SourceImagePanel
        {...common}
        images={[]}
        image={undefined}
        imageId=""
        onImageChange={() => undefined}
      />,
    );
    expect(find(TOUR_ANCHORS.faceSwapImageDropzone)?.tagName).toBe("DIV");
    expect(find(TOUR_ANCHORS.faceSwapImageButton)).toBeNull();
    emptyImage.unmount();

    const filledImage = render(
      <SourceImagePanel
        {...common}
        images={[image]}
        image={image}
        imageId="i1"
        onImageChange={() => undefined}
      />,
    );
    expect(find(TOUR_ANCHORS.faceSwapImageDropzone)).toBeNull();
    expect(find(TOUR_ANCHORS.faceSwapImageButton)).toHaveTextContent(
      "Cambiar imagen",
    );
    filledImage.unmount();

    const emptyVideo = render(
      <TargetVideoPanel
        {...common}
        videos={[]}
        video={undefined}
        videoId=""
        onVideoChange={() => undefined}
      />,
    );
    expect(find(TOUR_ANCHORS.faceSwapVideoDropzone)?.tagName).toBe("DIV");
    emptyVideo.unmount();

    render(
      <TargetVideoPanel
        {...common}
        videos={[video]}
        video={video}
        videoId="v1"
        onVideoChange={() => undefined}
      />,
    );
    expect(find(TOUR_ANCHORS.faceSwapVideoDropzone)).toBeNull();
    expect(find(TOUR_ANCHORS.faceSwapVideoButton)).toHaveTextContent(
      "Cambiar video",
    );
  });

  it("through the identity grid", () => {
    render(
      <IdentityGrid
        identities={[
          {
            id: "p1",
            label: "Persona 1",
            thumbnailDataUrl: "data:,",
            appearanceCount: 3,
          } as never,
        ]}
        selectedIdentityIds={[]}
        disabled={false}
        onSelectionChange={() => undefined}
      />,
    );
    expect(
      document.querySelector(tourSelector(TOUR_ANCHORS.faceSwapPeople)),
    ).toBeInTheDocument();
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

  it("through the new project modal fields and submit button", () => {
    render(
      <MemoryRouter>
        <NewProjectModal onClose={() => undefined} />
      </MemoryRouter>,
    );
    const name = document.querySelector(tourSelector(TOUR_ANCHORS.projectName));
    expect(name).toBeInstanceOf(HTMLInputElement);
    expect(name).toHaveAttribute("name", "name");
    const description = document.querySelector(
      tourSelector(TOUR_ANCHORS.projectDescription),
    );
    expect(description).toBeInstanceOf(HTMLTextAreaElement);
    const submit = document.querySelector(
      tourSelector(TOUR_ANCHORS.projectSubmit),
    );
    expect(submit).toHaveAttribute("type", "submit");
    expect(submit).toHaveTextContent("Crear proyecto");
  });
});
