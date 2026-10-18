import { BadRequestException } from "@nestjs/common";
import { MediaAssetKind } from "@prisma/client";
import { MediaService } from "./media.service";

describe("MediaService upload type validation", () => {
  function createService() {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: "project-1",
          userId: "user-1",
        }),
      },
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue({
          id: "asset-1",
          projectId: "project-1",
          name: "karaoke-result.mp4",
          status: "READY",
          storageKey: "projects/project-1/karaoke-result.mp4",
          project: { userId: "user-1" },
        }),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "asset-1",
            ...data,
          }),
        ),
      },
    };
    const storage = {
      getPresignedUploadUrl: jest.fn().mockResolvedValue("http://upload.test"),
      getPresignedDownloadUrl: jest
        .fn()
        .mockResolvedValue("http://download.test"),
    };
    return {
      service: new MediaService(prisma as any, storage as any),
      prisma,
      storage,
    };
  }

  it.each([
    [MediaAssetKind.ORIGINAL_AUDIO, "audio/mpeg", "song.mp3"],
    [MediaAssetKind.ORIGINAL_AUDIO, "video/mp4", "song.mp4"],
    [MediaAssetKind.ORIGINAL_AUDIO, "video/mpeg", "song.mpeg"],
    [MediaAssetKind.ORIGINAL_VIDEO, "video/mp4", "song.mp4"],
    [MediaAssetKind.FACE_SWAP_SOURCE_VIDEO, "video/mp4", "scene.mp4"],
    [MediaAssetKind.FACE_SWAP_SOURCE_IMAGE, "image/png", "face.png"],
    [MediaAssetKind.PROJECT_COVER_IMAGE, "image/webp", "cover.webp"],
    [MediaAssetKind.RECORDED_TAKE, "audio/webm", "take.webm"],
  ])("accepts %s with %s", async (kind, mimeType, fileName) => {
    const { service, prisma } = createService();

    await expect(
      service.requestUploadUrl("user-1", {
        projectId: "project-1",
        fileName,
        mimeType,
        kind,
        sizeBytes: 128,
      }),
    ).resolves.toMatchObject({ assetId: "asset-1" });

    expect(prisma.mediaAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind, mimeType }),
    });
  });

  it.each([
    [MediaAssetKind.ORIGINAL_AUDIO, "image/png"],
    [MediaAssetKind.ORIGINAL_VIDEO, "audio/mpeg"],
    [MediaAssetKind.FACE_SWAP_SOURCE_VIDEO, "audio/mpeg"],
    [MediaAssetKind.FACE_SWAP_SOURCE_IMAGE, "video/mp4"],
    [MediaAssetKind.PROJECT_COVER_IMAGE, "image/gif"],
    [MediaAssetKind.VIDEO_CLIP, "video/mp4"],
  ])("rejects MIME %s for incompatible kind %s", async (kind, mimeType) => {
    const { service } = createService();

    await expect(
      service.requestUploadUrl("user-1", {
        projectId: "project-1",
        fileName: "invalid.bin",
        mimeType,
        kind,
        sizeBytes: 128,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("requests an attachment download using the asset name", async () => {
    const { service, storage } = createService();

    await expect(
      service.getDownloadUrl("user-1", "asset-1"),
    ).resolves.toMatchObject({
      name: "karaoke-result.mp4",
      downloadUrl: "http://download.test",
    });

    expect(storage.getPresignedDownloadUrl).toHaveBeenCalledWith(
      "projects/project-1/karaoke-result.mp4",
      "karaoke-result.mp4",
    );
  });
});
