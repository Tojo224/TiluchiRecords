import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from './storage.service';
import { RequestUploadUrlDto, ConfirmUploadDto } from '../dto/create-upload-url.dto';
import { MediaAssetOrigin, MediaAssetStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

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
      throw new ForbiddenException('You do not own this project');
    }

    // Validate MIME types allowed for audio/video/image
    const allowedPrefixes = ['audio/', 'video/', 'image/'];
    if (!allowedPrefixes.some((prefix) => dto.mimeType.startsWith(prefix))) {
      throw new BadRequestException(`Unsupported media type: ${dto.mimeType}`);
    }

    const fileExtension = dto.fileName.split('.').pop() || 'bin';
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

    const uploadUrl = await this.storageService.getPresignedUploadUrl(storageKey, dto.mimeType);

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
      throw new ForbiddenException('You do not own this project asset');
    }

    return this.prisma.mediaAsset.update({
      where: { id: assetId },
      data: {
        status: MediaAssetStatus.READY,
        durationSeconds: dto.durationSeconds,
      },
    });
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
      throw new ForbiddenException('You do not own this project asset');
    }

    if (asset.status !== MediaAssetStatus.READY) {
      throw new BadRequestException(`MediaAsset is not ready for download (status: ${asset.status})`);
    }

    const downloadUrl = await this.storageService.getPresignedDownloadUrl(asset.storageKey);

    return {
      assetId: asset.id,
      name: asset.name,
      downloadUrl,
      expiresInSeconds: 3600,
    };
  }
}
