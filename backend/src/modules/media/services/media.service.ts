import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { StorageService } from "./storage.service";
import {
  RequestUploadUrlDto,
  ConfirmUploadDto,
} from "../dto/create-upload-url.dto";
import {
  MediaAssetKind,
  MediaAssetOrigin,
  MediaAssetStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async requestUploadUrl(userId: string, dto: RequestUploadUrlDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    if (project.userId !== userId) {
      throw new ForbiddenException("You do not own this project");
    }

    this.validateUploadedAssetType(dto.kind, dto.mimeType);
    if (
      dto.kind === MediaAssetKind.PROJECT_COVER_IMAGE &&
      Number(dto.sizeBytes || 0) > 10 * 1024 * 1024
    ) {
      throw new BadRequestException("Project cover image cannot exceed 10 MB");
    }

    const fileExtension = dto.fileName.split(".").pop() || "bin";
    const storageKey = `projects/${dto.projectId}/${dto.kind.toLowerCase()}/${randomUUID()}.${fileExtension}`;

    // Register asset in UPLOADING state (Decision D-04)
    const asset = await this.prisma.mediaAsset.create({
      data: {
        projectId: dto.projectId,
        name: dto.fileName,
        origin: MediaAssetOrigin.UPLOADED,
        status: MediaAssetStatus.UPLOADING,
        kind: dto.kind,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes ? BigInt(dto.sizeBytes) : null,
        storageKey,
      },
    });

    const uploadUrl = await this.storageService.getPresignedUploadUrl(
      storageKey,
      dto.mimeType,
    );

    return {
      assetId: asset.id,
      storageKey,
      uploadUrl,
      expiresInSeconds: 900,
    };
  }

  async confirmUpload(userId: string, assetId: string, dto: ConfirmUploadDto) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
      include: { project: true },
    });

    if (!asset) {
      throw new NotFoundException(`MediaAsset with ID ${assetId} not found`);
    }

    if (asset.project.userId !== userId) {
      throw new ForbiddenException("You do not own this project asset");
    }

    const updatedAsset = await this.prisma.mediaAsset.update({
      where: { id: assetId },
      data: {
        status: MediaAssetStatus.READY,
        durationSeconds: dto.durationSeconds,
      },
    });

    return this.serializeAsset(updatedAsset);
  }

  async findByProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (project.userId !== userId) {
      throw new ForbiddenException("You do not own this project");
    }

    const assets = await this.prisma.mediaAsset.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return assets.map((asset) => this.serializeAsset(asset));
  }

  async getDownloadUrl(userId: string, assetId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
      include: { project: true },
    });

    if (!asset) {
      throw new NotFoundException(`MediaAsset with ID ${assetId} not found`);
    }

    if (asset.project.userId !== userId) {
      throw new ForbiddenException("You do not own this project asset");
    }

    if (asset.status !== MediaAssetStatus.READY) {
      throw new BadRequestException(
        `MediaAsset is not ready for download (status: ${asset.status})`,
      );
    }

    const downloadUrl = await this.storageService.getPresignedDownloadUrl(
      asset.storageKey,
      asset.name,
    );

    return {
      assetId: asset.id,
      name: asset.name,
      downloadUrl,
      expiresInSeconds: 3600,
    };
  }

  async remove(userId: string, assetId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
      include: { project: true },
    });

    if (!asset) {
      throw new NotFoundException(`MediaAsset with ID ${assetId} not found`);
    }

    if (asset.project.userId !== userId) {
      throw new ForbiddenException("You do not own this project asset");
    }

    await this.storageService
      .deleteObject(asset.storageKey)
      .catch(() => undefined);
    const deleted = await this.prisma.mediaAsset.delete({
      where: { id: assetId },
    });

    return this.serializeAsset(deleted);
  }

  async cleanupOrphans(userId: string, olderThanMinutes = 30) {
    const cutoff = new Date(
      Date.now() - Math.max(0, olderThanMinutes) * 60 * 1000,
    );
    const orphanAssets = await this.prisma.mediaAsset.findMany({
      where: {
        status: MediaAssetStatus.UPLOADING,
        createdAt: {
          lt: cutoff,
        },
        project: {
          userId,
        },
      },
    });

    const deletedAssets = [];
    for (const asset of orphanAssets) {
      await this.storageService
        .deleteObject(asset.storageKey)
        .catch(() => undefined);
      const deleted = await this.prisma.mediaAsset.delete({
        where: { id: asset.id },
      });
      deletedAssets.push(this.serializeAsset(deleted));
    }

    return {
      deletedCount: deletedAssets.length,
      deletedAssets,
      cutoff,
    };
  }

  private serializeAsset<T extends { sizeBytes?: bigint | null }>(asset: T) {
    return {
      ...asset,
      sizeBytes: asset.sizeBytes?.toString() ?? null,
    };
  }

  private validateUploadedAssetType(kind: MediaAssetKind, mimeType: string) {
    const normalizedMime = mimeType.toLowerCase();
    const isProjectCover = ["image/jpeg", "image/png", "image/webp"].includes(
      normalizedMime,
    );
    const isMusic =
      normalizedMime.startsWith("audio/") ||
      ["video/mp4", "video/mpeg"].includes(normalizedMime);
    const accepted =
      (kind === MediaAssetKind.PROJECT_COVER_IMAGE && isProjectCover) ||
      (kind === MediaAssetKind.ORIGINAL_AUDIO && isMusic) ||
      (kind === MediaAssetKind.ORIGINAL_VIDEO &&
        normalizedMime.startsWith("video/")) ||
      (kind === MediaAssetKind.RECORDED_TAKE &&
        normalizedMime.startsWith("audio/")) ||
      (kind === MediaAssetKind.FACE_SWAP_SOURCE_VIDEO &&
        normalizedMime.startsWith("video/")) ||
      (kind === MediaAssetKind.FACE_SWAP_SOURCE_IMAGE &&
        normalizedMime.startsWith("image/"));

    if (!accepted) {
      throw new BadRequestException(
        `Media type ${mimeType} is not valid for asset kind ${kind}`,
      );
    }
  }
}
