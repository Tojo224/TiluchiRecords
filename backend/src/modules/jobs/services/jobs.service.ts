import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { JobQueueService } from "./job-queue.service";
import { CreateJobDto } from "../dto/create-job.dto";
import {
  JobStatus,
  JobType,
  MediaAssetKind,
  MediaAssetOrigin,
  MediaAssetStatus,
} from "@prisma/client";

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: JobQueueService,
  ) {}

  async createJob(userId: string, dto: CreateJobDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    if (project.userId !== userId) {
      throw new ForbiddenException("You do not own this project");
    }

    const enrichedPayload = await this.validateAndBuildPayload(dto);

    const job = await this.prisma.processingJob.create({
      data: {
        projectId: dto.projectId,
        type: dto.type,
        status: JobStatus.PENDING,
        progress: 0,
        payload: enrichedPayload,
      },
    });

    // Enqueue job to Redis for Python worker consumption
    await this.queueService.enqueue({
      job_id: job.id,
      project_id: job.projectId,
      type: job.type,
      payload: job.payload,
    });

    return job;
  }

  async getJob(userId: string, jobId: string) {
    const job = await this.prisma.processingJob.findUnique({
      where: { id: jobId },
      include: {
        project: true,
        stages: { orderBy: { startedAt: "asc" } },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    if (job.project.userId !== userId) {
      throw new ForbiddenException("You do not have access to this job");
    }

    return {
      id: job.id,
      projectId: job.projectId,
      type: job.type,
      status: job.status,
      progress: job.progress,
      errorMessage: job.errorMessage,
      result: job.result,
      stages: job.stages,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
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

    return this.prisma.processingJob.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        stages: { orderBy: { startedAt: "asc" } },
      },
    });
  }

  async retryJob(userId: string, jobId: string) {
    const originalJob = await this.prisma.processingJob.findUnique({
      where: { id: jobId },
      include: { project: true },
    });

    if (!originalJob) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    if (originalJob.project.userId !== userId) {
      throw new ForbiddenException("You do not have access to this job");
    }

    if (
      originalJob.status !== JobStatus.FAILED &&
      originalJob.status !== JobStatus.CANCELLED
    ) {
      throw new BadRequestException(
        "Only failed or cancelled jobs can be retried",
      );
    }

    const retryJob = await this.prisma.processingJob.create({
      data: {
        projectId: originalJob.projectId,
        type: originalJob.type,
        status: JobStatus.PENDING,
        progress: 0,
        payload: originalJob.payload || {},
        result: {
          retriedFromJobId: originalJob.id,
        },
      },
    });

    await this.queueService.enqueue({
      job_id: retryJob.id,
      project_id: retryJob.projectId,
      type: retryJob.type,
      payload: retryJob.payload,
    });

    return retryJob;
  }

  async failStaleProcessingJobs(staleAfterMs: number) {
    const cutoff = new Date(Date.now() - Math.max(60_000, staleAfterMs));
    return this.prisma.processingJob.updateMany({
      where: {
        status: JobStatus.PROCESSING,
        updatedAt: { lt: cutoff },
      },
      data: {
        status: JobStatus.FAILED,
        errorMessage:
          "El procesamiento se interrumpio porque el worker dejo de reportar progreso. Puedes reintentarlo.",
      },
    });
  }

  async updateJobProgress(
    jobId: string,
    status: JobStatus,
    progress: number,
    result?: any,
    error?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const currentJob = await tx.processingJob.findUnique({
        where: { id: jobId },
      });
      if (!currentJob) {
        throw new NotFoundException(`ProcessingJob with ID ${jobId} not found`);
      }
      const terminalStatuses: JobStatus[] = [
        JobStatus.COMPLETED,
        JobStatus.FAILED,
        JobStatus.CANCELLED,
      ];
      if (
        terminalStatuses.includes(currentJob.status) &&
        currentJob.status !== status
      ) {
        return currentJob;
      }
      const job = await tx.processingJob.update({
        where: { id: jobId },
        data: {
          status,
          progress,
          result: result ?? undefined,
          errorMessage: error ?? undefined,
        },
      });

      if (
        status === JobStatus.COMPLETED &&
        Array.isArray(result?.generatedAssets)
      ) {
        for (const generatedAsset of result.generatedAssets) {
          const existing = await tx.mediaAsset.findFirst({
            where: {
              projectId: job.projectId,
              storageKey: generatedAsset.storageKey,
            },
          });

          if (!existing) {
            await tx.mediaAsset.create({
              data: {
                projectId: job.projectId,
                name: generatedAsset.name,
                origin: MediaAssetOrigin.GENERATED,
                status: MediaAssetStatus.READY,
                kind: generatedAsset.kind,
                mimeType: generatedAsset.mimeType,
                sizeBytes: generatedAsset.sizeBytes
                  ? BigInt(generatedAsset.sizeBytes)
                  : null,
                durationSeconds: generatedAsset.durationSeconds,
                storageKey: generatedAsset.storageKey,
                metadata: {
                  ...(generatedAsset.metadata || {}),
                  sourceJobId: jobId,
                },
              },
            });
          }
        }
      }

      return job;
    });
  }

  private async validateAndBuildPayload(dto: CreateJobDto) {
    const payload = dto.payload || {};

    if (dto.type === JobType.GENERATE_KARAOKE) {
      if (!payload.videoAssetId) {
        throw new BadRequestException(
          "GENERATE_KARAOKE requires payload.videoAssetId",
        );
      }

      const sourceVideo = await this.getReadyKaraokeVideo(
        dto.projectId,
        payload.videoAssetId,
      );

      return {
        ...payload,
        sourceVideoAsset: this.serializeAssetForWorker(sourceVideo),
        subtitleLeadSeconds: 1,
      };
    }

    if (dto.type === JobType.AUDIO_SEPARATION) {
      if (!payload.audioAssetId) {
        throw new BadRequestException(
          "AUDIO_SEPARATION requires payload.audioAssetId",
        );
      }

      const asset = await this.getReadyOriginalAudio(
        dto.projectId,
        payload.audioAssetId,
        "AUDIO_SEPARATION",
      );

      return {
        ...payload,
        sourceAsset: this.serializeAssetForWorker(asset),
      };
    }

    if (dto.type === JobType.GENERATE_FINAL_MIX) {
      const vocalInputAssetId =
        payload.recordedTakeAssetId || payload.vocalAssetId;
      if (!payload.instrumentalAssetId || !vocalInputAssetId) {
        throw new BadRequestException(
          "GENERATE_FINAL_MIX requires payload.instrumentalAssetId and payload.recordedTakeAssetId",
        );
      }

      const instrumentalAsset = await this.getReadyAsset(
        dto.projectId,
        payload.instrumentalAssetId,
        MediaAssetKind.INSTRUMENTAL_STEM,
        "GENERATE_FINAL_MIX",
      );
      const vocalAsset = await this.prisma.mediaAsset.findUnique({
        where: { id: vocalInputAssetId },
      });

      if (!vocalAsset) {
        throw new NotFoundException(
          `MediaAsset with ID ${vocalInputAssetId} not found`,
        );
      }

      if (vocalAsset.projectId !== dto.projectId) {
        throw new BadRequestException(
          "Selected vocal asset does not belong to this project",
        );
      }

      if (vocalAsset.status !== MediaAssetStatus.READY) {
        throw new BadRequestException(
          `Selected vocal asset is not ready (status: ${vocalAsset.status})`,
        );
      }

      if (
        (vocalAsset.kind !== MediaAssetKind.RECORDED_TAKE &&
          vocalAsset.kind !== MediaAssetKind.VOCAL_STEM) ||
        !vocalAsset.mimeType.startsWith("audio/")
      ) {
        throw new BadRequestException(
          "GENERATE_FINAL_MIX requires a READY RECORDED_TAKE or VOCAL_STEM audio asset",
        );
      }

      return {
        ...payload,
        recordedTakeAssetId: vocalInputAssetId,
        instrumentalAsset: this.serializeAssetForWorker(instrumentalAsset),
        recordedTakeAsset: this.serializeAssetForWorker(vocalAsset),
        vocalVolume: Number.isFinite(Number(payload.vocalVolume))
          ? Number(payload.vocalVolume)
          : 1,
        instrumentalVolume: Number.isFinite(Number(payload.instrumentalVolume))
          ? Number(payload.instrumentalVolume)
          : 0.9,
      };
    }

    if (dto.type === JobType.ANALYZE_VIDEO_FACES) {
      if (!payload.sourceVideoAssetId) {
        throw new BadRequestException(
          "ANALYZE_VIDEO_FACES requires payload.sourceVideoAssetId",
        );
      }

      const sourceVideo = await this.getReadyFaceSwapVideo(
        dto.projectId,
        payload.sourceVideoAssetId,
        "ANALYZE_VIDEO_FACES",
      );
      return {
        sourceVideoAssetId: sourceVideo.id,
        sourceVideoAsset: this.serializeAssetForWorker(sourceVideo),
      };
    }

    if (dto.type === JobType.FACE_SWAP) {
      const requestedIdentityIds = Array.from(
        new Set(
          (Array.isArray(payload.targetIdentityIds)
            ? payload.targetIdentityIds
            : payload.targetIdentityId
              ? [payload.targetIdentityId]
              : []
          ).filter((identityId: unknown) => typeof identityId === "string"),
        ),
      ) as string[];
      if (
        !payload.sourceVideoAssetId ||
        !payload.sourceImageAssetId ||
        !payload.consentLogId ||
        !payload.faceAnalysisJobId ||
        requestedIdentityIds.length === 0
      ) {
        throw new BadRequestException(
          "FACE_SWAP requires source video, source image, consent and at least one detected target identity",
        );
      }

      const [videoAsset, imageAsset, consentLog, analysisJob] =
        await Promise.all([
          this.prisma.mediaAsset.findUnique({
            where: { id: payload.sourceVideoAssetId },
          }),
          this.prisma.mediaAsset.findUnique({
            where: { id: payload.sourceImageAssetId },
          }),
          this.prisma.consentLog.findUnique({
            where: { id: payload.consentLogId },
          }),
          this.prisma.processingJob.findUnique({
            where: { id: payload.faceAnalysisJobId },
          }),
        ]);

      if (!videoAsset) {
        throw new NotFoundException(
          `MediaAsset with ID ${payload.sourceVideoAssetId} not found`,
        );
      }

      if (!imageAsset) {
        throw new NotFoundException(
          `MediaAsset with ID ${payload.sourceImageAssetId} not found`,
        );
      }

      if (!consentLog) {
        throw new NotFoundException(
          `ConsentLog with ID ${payload.consentLogId} not found`,
        );
      }

      if (!analysisJob) {
        throw new NotFoundException(
          `ProcessingJob with ID ${payload.faceAnalysisJobId} not found`,
        );
      }

      if (
        videoAsset.projectId !== dto.projectId ||
        imageAsset.projectId !== dto.projectId ||
        consentLog.projectId !== dto.projectId
      ) {
        throw new BadRequestException(
          "Face swap resources must belong to the selected project",
        );
      }

      if (
        analysisJob.projectId !== dto.projectId ||
        analysisJob.type !== JobType.ANALYZE_VIDEO_FACES ||
        analysisJob.status !== JobStatus.COMPLETED
      ) {
        throw new BadRequestException(
          "The selected face analysis is not completed or belongs to another project",
        );
      }

      const analysisResult = (analysisJob.result || {}) as Record<string, any>;
      if (analysisResult.sourceVideoAssetId !== videoAsset.id) {
        throw new BadRequestException(
          "The selected identity was detected in a different video",
        );
      }
      const identities = Array.isArray(analysisResult.identities)
        ? analysisResult.identities
        : [];
      const targetIdentities = requestedIdentityIds.map((identityId) =>
        identities.find((identity: any) => identity?.id === identityId),
      );
      if (targetIdentities.some((identity) => !identity)) {
        throw new BadRequestException(
          "One or more selected target identities do not exist in the face analysis",
        );
      }

      if (!consentLog.termsAccepted) {
        throw new BadRequestException("Face swap consent must be accepted");
      }

      if (
        videoAsset.status !== MediaAssetStatus.READY ||
        !(<MediaAssetKind[]>[
          MediaAssetKind.FACE_SWAP_SOURCE_VIDEO,
          MediaAssetKind.ORIGINAL_VIDEO,
        ]).includes(videoAsset.kind) ||
        !videoAsset.mimeType.startsWith("video/")
      ) {
        throw new BadRequestException(
          "FACE_SWAP requires a READY FACE_SWAP_SOURCE_VIDEO asset",
        );
      }

      if (
        imageAsset.status !== MediaAssetStatus.READY ||
        imageAsset.kind !== MediaAssetKind.FACE_SWAP_SOURCE_IMAGE ||
        !imageAsset.mimeType.startsWith("image/")
      ) {
        throw new BadRequestException(
          "FACE_SWAP requires a READY FACE_SWAP_SOURCE_IMAGE asset",
        );
      }

      return {
        ...payload,
        targetIdentityIds: requestedIdentityIds,
        targetIdentities: targetIdentities.map((identity: any) => ({
          id: identity.id,
          referenceFrameNumber: Math.max(
            0,
            Math.floor(Number(identity.referenceFrameNumber) || 0),
          ),
          referenceFacePosition: Math.max(
            0,
            Math.floor(Number(identity.referenceFacePosition) || 0),
          ),
        })),
        sourceVideoAsset: this.serializeAssetForWorker(videoAsset),
        sourceImageAsset: this.serializeAssetForWorker(imageAsset),
        consent: {
          id: consentLog.id,
          termsAccepted: consentLog.termsAccepted,
          createdAt: consentLog.createdAt.toISOString(),
        },
      };
    }

    if (dto.type === JobType.ANALYZE_AUDIO) {
      if (!payload.audioAssetId) {
        throw new BadRequestException(
          "ANALYZE_AUDIO requires payload.audioAssetId",
        );
      }

      const asset = await this.getReadyOriginalAudio(
        dto.projectId,
        payload.audioAssetId,
        "ANALYZE_AUDIO",
      );

      return {
        ...payload,
        sourceAsset: this.serializeAssetForWorker(asset),
      };
    }

    if (dto.type === JobType.GENERATE_STORYBOARD) {
      const analysisJobId = payload.analysisJobId || payload.audioAnalysisJobId;
      const visualPrompt =
        typeof payload.visualPrompt === "string"
          ? payload.visualPrompt.trim()
          : "";

      if (!analysisJobId || !visualPrompt) {
        throw new BadRequestException(
          "GENERATE_STORYBOARD requires payload.analysisJobId and payload.visualPrompt",
        );
      }

      const analysisJob = await this.getCompletedJob(
        dto.projectId,
        analysisJobId,
        JobType.ANALYZE_AUDIO,
      );

      return {
        ...payload,
        analysisJobId,
        visualPrompt,
        audioAnalysis: analysisJob.result || {},
      };
    }

    if (dto.type === JobType.GENERATE_VIDEO_CLIPS) {
      const storyboardJobId = payload.storyboardJobId;
      let storyboard = Array.isArray(payload.storyboard)
        ? payload.storyboard
        : null;
      let storyboardSourceJobId = storyboardJobId;

      if (storyboardJobId) {
        const storyboardJob = await this.getCompletedJob(
          dto.projectId,
          storyboardJobId,
          JobType.GENERATE_STORYBOARD,
        );
        const result = storyboardJob.result as any;
        storyboard = Array.isArray(result?.scenes)
          ? result.scenes
          : Array.isArray(result)
            ? result
            : null;
        storyboardSourceJobId = storyboardJob.id;
      }

      if (!storyboard?.length) {
        throw new BadRequestException(
          "GENERATE_VIDEO_CLIPS requires payload.storyboard or payload.storyboardJobId with completed scenes",
        );
      }
      if (!payload.audioAssetId) {
        throw new BadRequestException(
          "GENERATE_VIDEO_CLIPS requires payload.audioAssetId for lyric synchronization",
        );
      }
      const audioAsset = await this.getReadyOriginalAudio(
        dto.projectId,
        payload.audioAssetId,
        "GENERATE_VIDEO_CLIPS",
      );

      return {
        ...payload,
        storyboard,
        storyboardJobId: storyboardSourceJobId,
        sourceAudioAsset: this.serializeAssetForWorker(audioAsset),
        style:
          typeof payload.style === "string" && payload.style.trim()
            ? payload.style.trim()
            : "cinematic",
      };
    }

    if (dto.type === JobType.COMPOSE_VIDEOCLIP) {
      if (
        !payload.audioAssetId ||
        !Array.isArray(payload.clipAssetIds) ||
        payload.clipAssetIds.length === 0
      ) {
        throw new BadRequestException(
          "COMPOSE_VIDEOCLIP requires payload.audioAssetId and payload.clipAssetIds",
        );
      }

      const audioAsset = await this.getReadyOriginalAudio(
        dto.projectId,
        payload.audioAssetId,
        "COMPOSE_VIDEOCLIP",
      );
      const clipAssets = await Promise.all(
        payload.clipAssetIds.map((assetId: string) =>
          this.getReadyAsset(
            dto.projectId,
            assetId,
            MediaAssetKind.VIDEO_CLIP,
            "COMPOSE_VIDEOCLIP",
          ),
        ),
      );

      return {
        ...payload,
        sourceAudioAsset: this.serializeAssetForWorker(audioAsset),
        clipAssets: clipAssets.map((asset) =>
          this.serializeAssetForWorker(asset),
        ),
      };
    }

    return payload;
  }

  private async getReadyOriginalAudio(
    projectId: string,
    assetId: string,
    context: string,
  ) {
    const asset = await this.getReadyAsset(
      projectId,
      assetId,
      MediaAssetKind.ORIGINAL_AUDIO,
      context,
    );

    if (!this.isSupportedMusicInput(asset.mimeType)) {
      throw new BadRequestException(
        `${context} requires a READY ORIGINAL_AUDIO asset`,
      );
    }

    return asset;
  }

  private async getReadyKaraokeVideo(projectId: string, assetId: string) {
    return this.getReadyFaceSwapVideo(projectId, assetId, "GENERATE_KARAOKE");
  }

  private async getReadyFaceSwapVideo(
    projectId: string,
    assetId: string,
    context: string,
  ) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException(`MediaAsset with ID ${assetId} not found`);
    }
    if (asset.projectId !== projectId) {
      throw new BadRequestException(
        "Selected asset does not belong to this project",
      );
    }
    if (asset.status !== MediaAssetStatus.READY) {
      throw new BadRequestException(
        `Selected asset is not ready (status: ${asset.status})`,
      );
    }
    if (
      !(<MediaAssetKind[]>[
        MediaAssetKind.ORIGINAL_VIDEO,
        MediaAssetKind.FACE_SWAP_SOURCE_VIDEO,
      ]).includes(asset.kind) ||
      !asset.mimeType.toLowerCase().startsWith("video/")
    ) {
      throw new BadRequestException(`${context} requires a READY video asset`);
    }

    return asset;
  }

  private isSupportedMusicInput(mimeType: string) {
    return (
      mimeType.startsWith("audio/") ||
      ["video/mp4", "video/mpeg"].includes(mimeType.toLowerCase())
    );
  }

  private async getReadyAsset(
    projectId: string,
    assetId: string,
    expectedKind: MediaAssetKind,
    context: string,
  ) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException(`MediaAsset with ID ${assetId} not found`);
    }

    if (asset.projectId !== projectId) {
      throw new BadRequestException(
        "Selected asset does not belong to this project",
      );
    }

    if (asset.status !== MediaAssetStatus.READY) {
      throw new BadRequestException(
        `Selected asset is not ready (status: ${asset.status})`,
      );
    }

    if (asset.kind !== expectedKind) {
      throw new BadRequestException(
        `${context} requires a READY ${expectedKind} asset`,
      );
    }

    return asset;
  }

  private async getCompletedJob(
    projectId: string,
    jobId: string,
    expectedType: JobType,
  ) {
    const job = await this.prisma.processingJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`ProcessingJob with ID ${jobId} not found`);
    }

    if (job.projectId !== projectId) {
      throw new BadRequestException(
        "Selected job does not belong to this project",
      );
    }

    if (job.type !== expectedType) {
      throw new BadRequestException(`Selected job must be ${expectedType}`);
    }

    if (job.status !== JobStatus.COMPLETED) {
      throw new BadRequestException(
        `Selected job must be completed (status: ${job.status})`,
      );
    }

    return job;
  }

  private serializeAssetForWorker(asset: {
    id: string;
    projectId: string;
    name: string;
    kind: MediaAssetKind;
    mimeType: string;
    storageKey: string;
    sizeBytes?: bigint | null;
    metadata?: any;
  }) {
    return {
      id: asset.id,
      projectId: asset.projectId,
      name: asset.name,
      kind: asset.kind,
      mimeType: asset.mimeType,
      storageKey: asset.storageKey,
      sizeBytes: asset.sizeBytes?.toString() ?? null,
      metadata: asset.metadata || {},
    };
  }
}
