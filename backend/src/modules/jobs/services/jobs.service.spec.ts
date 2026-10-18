import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { JobStatus, JobType } from "@prisma/client";
import { JobsService } from "./jobs.service";

describe("JobsService", () => {
  const project = {
    id: "project-1",
    userId: "user-1",
  };
  const audioAsset = {
    id: "asset-1",
    projectId: "project-1",
    name: "song.wav",
    kind: "ORIGINAL_AUDIO",
    status: "READY",
    mimeType: "audio/wav",
    storageKey: "projects/project-1/original_audio/song.wav",
    sizeBytes: BigInt(16),
  };
  const videoAsset = {
    id: "video-1",
    projectId: "project-1",
    name: "source.mp4",
    kind: "FACE_SWAP_SOURCE_VIDEO",
    status: "READY",
    mimeType: "video/mp4",
    storageKey: "projects/project-1/face_swap_source_video/source.mp4",
    sizeBytes: BigInt(32),
  };
  const mp4MusicAsset = {
    ...audioAsset,
    id: "music-mp4-1",
    name: "song.mp4",
    mimeType: "video/mp4",
    storageKey: "projects/project-1/original_audio/song.mp4",
  };
  const imageAsset = {
    id: "image-1",
    projectId: "project-1",
    name: "face.png",
    kind: "FACE_SWAP_SOURCE_IMAGE",
    status: "READY",
    mimeType: "image/png",
    storageKey: "projects/project-1/face_swap_source_image/face.png",
    sizeBytes: BigInt(16),
  };
  const clipAsset = {
    id: "clip-1",
    projectId: "project-1",
    name: "clip-1.mp4",
    kind: "VIDEO_CLIP",
    status: "READY",
    mimeType: "video/mp4",
    storageKey: "projects/project-1/video_clip/clip-1.mp4",
    sizeBytes: BigInt(64),
    metadata: {
      scene: {
        sceneIndex: 1,
        startTime: 0,
        endTime: 8,
        description: "Escena de prueba",
      },
    },
  };
  const consentLog = {
    id: "consent-1",
    projectId: "project-1",
    userId: "user-1",
    termsAccepted: true,
    consentText: "accepted",
    createdAt: new Date(),
  };

  function createService(prismaOverrides: Record<string, any> = {}) {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue(project),
      },
      mediaAsset: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          if (where.id === "asset-1") return Promise.resolve(audioAsset);
          if (where.id === "music-mp4-1") return Promise.resolve(mp4MusicAsset);
          if (where.id === "video-1") return Promise.resolve(videoAsset);
          if (where.id === "image-1") return Promise.resolve(imageAsset);
          if (where.id === "clip-1") return Promise.resolve(clipAsset);
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      consentLog: {
        findUnique: jest.fn().mockResolvedValue(consentLog),
      },
      processingJob: {
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: "job-1",
            ...data,
            payload: data.payload || {
              audioAssetId: "asset-1",
              sourceAsset: {
                id: "asset-1",
                projectId: "project-1",
                name: "song.wav",
                kind: "ORIGINAL_AUDIO",
                mimeType: "audio/wav",
                storageKey: "projects/project-1/original_audio/song.wav",
                sizeBytes: "16",
              },
            },
          }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          if (where.id === "face-analysis-job-1") {
            return Promise.resolve({
              id: "face-analysis-job-1",
              projectId: "project-1",
              type: JobType.ANALYZE_VIDEO_FACES,
              status: JobStatus.COMPLETED,
              result: {
                sourceVideoAssetId: "video-1",
                identities: [
                  {
                    id: "person-1",
                    referenceFrameNumber: 145,
                    referenceFacePosition: 1,
                  },
                  {
                    id: "person-2",
                    referenceFrameNumber: 320,
                    referenceFacePosition: 0,
                  },
                ],
              },
            });
          }

          if (where.id === "analysis-job-1") {
            return Promise.resolve({
              id: "analysis-job-1",
              projectId: "project-1",
              type: JobType.ANALYZE_AUDIO,
              status: JobStatus.COMPLETED,
              progress: 100,
              result: {
                durationSeconds: 24,
                tempo: 120,
                suggestedScenes: 3,
              },
            });
          }

          if (where.id === "storyboard-job-1") {
            return Promise.resolve({
              id: "storyboard-job-1",
              projectId: "project-1",
              type: JobType.GENERATE_STORYBOARD,
              status: JobStatus.COMPLETED,
              progress: 100,
              result: {
                scenes: [
                  {
                    sceneIndex: 1,
                    startTime: 0,
                    endTime: 8,
                    description: "Escena de prueba",
                  },
                ],
              },
            });
          }

          return Promise.resolve({
            id: "failed-job-1",
            projectId: "project-1",
            type: JobType.FACE_SWAP,
            status: JobStatus.FAILED,
            progress: 100,
            payload: {
              sourceVideoAssetId: "video-1",
              sourceImageAssetId: "image-1",
              consentLogId: "consent-1",
            },
            project,
          });
        }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(async (callback) => callback(prisma)),
      ...prismaOverrides,
    };
    const queue = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    };

    return {
      service: new JobsService(prisma as any, queue as any),
      prisma,
      queue,
    };
  }

  it("creates and enqueues an audio separation job", async () => {
    const { service, queue } = createService();

    await expect(
      service.createJob("user-1", {
        projectId: "project-1",
        type: JobType.AUDIO_SEPARATION,
        payload: { audioAssetId: "asset-1" },
      }),
    ).resolves.toMatchObject({
      id: "job-1",
      status: JobStatus.PENDING,
    });

    expect(queue.enqueue).toHaveBeenCalledWith({
      job_id: "job-1",
      project_id: "project-1",
      type: JobType.AUDIO_SEPARATION,
      payload: expect.objectContaining({
        audioAssetId: "asset-1",
        sourceAsset: expect.objectContaining({
          storageKey: "projects/project-1/original_audio/song.wav",
        }),
      }),
    });
  });

  it("creates one karaoke job from a ready video", async () => {
    const { service, queue } = createService();

    await expect(
      service.createJob("user-1", {
        projectId: "project-1",
        type: JobType.GENERATE_KARAOKE,
        payload: { videoAssetId: "video-1" },
      }),
    ).resolves.toMatchObject({
      id: "job-1",
      type: JobType.GENERATE_KARAOKE,
    });

    expect(queue.enqueue).toHaveBeenCalledWith({
      job_id: "job-1",
      project_id: "project-1",
      type: JobType.GENERATE_KARAOKE,
      payload: expect.objectContaining({
        videoAssetId: "video-1",
        subtitleLeadSeconds: 1,
        sourceVideoAsset: expect.objectContaining({
          id: "video-1",
          mimeType: "video/mp4",
          storageKey: videoAsset.storageKey,
        }),
      }),
    });
  });

  it("rejects karaoke generation from an audio-only asset", async () => {
    const { service } = createService();

    await expect(
      service.createJob("user-1", {
        projectId: "project-1",
        type: JobType.GENERATE_KARAOKE,
        payload: { videoAssetId: "asset-1" },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a legacy audio asset even when its MIME type says video", async () => {
    const mislabeledAudio = {
      ...audioAsset,
      name: "song.mpeg",
      mimeType: "video/mpeg",
    };
    const { service } = createService({
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue(mislabeledAudio),
      },
    });

    await expect(
      service.createJob("user-1", {
        projectId: "project-1",
        type: JobType.GENERATE_KARAOKE,
        payload: { videoAssetId: mislabeledAudio.id },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ["video/mp4", "song.mp4"],
    ["video/mpeg", "song.mpeg"],
  ])("accepts %s containers as music input", async (mimeType, name) => {
    const musicAsset = { ...mp4MusicAsset, mimeType, name };
    const { service, queue } = createService({
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue(musicAsset),
      },
    });

    await expect(
      service.createJob("user-1", {
        projectId: "project-1",
        type: JobType.ANALYZE_AUDIO,
        payload: { audioAssetId: musicAsset.id },
      }),
    ).resolves.toMatchObject({ type: JobType.ANALYZE_AUDIO });

    expect(queue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          sourceAsset: expect.objectContaining({ mimeType, name }),
        }),
      }),
    );
  });

  it("rejects jobs for projects that do not exist", async () => {
    const { service } = createService({
      project: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.createJob("user-1", {
        projectId: "missing-project",
        type: JobType.AUDIO_SEPARATION,
        payload: { audioAssetId: "asset-1" },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects jobs for projects owned by another user", async () => {
    const { service } = createService({
      project: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...project, userId: "other-user" }),
      },
    });

    await expect(
      service.createJob("user-1", {
        projectId: "project-1",
        type: JobType.AUDIO_SEPARATION,
        payload: { audioAssetId: "asset-1" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("validates required payload for audio separation", async () => {
    const { service } = createService();

    await expect(
      service.createJob("user-1", {
        projectId: "project-1",
        type: JobType.AUDIO_SEPARATION,
        payload: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("validates required payload for karaoke generation", async () => {
    const { service } = createService();

    await expect(
      service.createJob("user-1", {
        projectId: "project-1",
        type: JobType.GENERATE_KARAOKE,
        payload: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects audio separation when the selected asset is not ready audio", async () => {
    const { service } = createService({
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue({
          ...audioAsset,
          status: "UPLOADING",
        }),
      },
    });

    await expect(
      service.createJob("user-1", {
        projectId: "project-1",
        type: JobType.AUDIO_SEPARATION,
        payload: { audioAssetId: "asset-1" },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates face swap job only with consent and valid resources", async () => {
    const { service, queue } = createService();

    await expect(
      service.createJob("user-1", {
        projectId: "project-1",
        type: JobType.FACE_SWAP,
        payload: {
          sourceVideoAssetId: "video-1",
          sourceImageAssetId: "image-1",
          consentLogId: "consent-1",
          faceAnalysisJobId: "face-analysis-job-1",
          targetIdentityIds: ["person-1", "person-2"],
        },
      }),
    ).resolves.toMatchObject({
      id: "job-1",
      type: JobType.FACE_SWAP,
    });

    expect(queue.enqueue).toHaveBeenCalledWith({
      job_id: "job-1",
      project_id: "project-1",
      type: JobType.FACE_SWAP,
      payload: expect.objectContaining({
        consentLogId: "consent-1",
        faceAnalysisJobId: "face-analysis-job-1",
        targetIdentityIds: ["person-1", "person-2"],
        targetIdentities: [
          {
            id: "person-1",
            referenceFrameNumber: 145,
            referenceFacePosition: 1,
          },
          {
            id: "person-2",
            referenceFrameNumber: 320,
            referenceFacePosition: 0,
          },
        ],
        sourceVideoAsset: expect.objectContaining({
          storageKey: videoAsset.storageKey,
        }),
        sourceImageAsset: expect.objectContaining({
          storageKey: imageAsset.storageKey,
        }),
      }),
    });
  });

  it("creates a video face analysis job with a validated source", async () => {
    const { service, queue } = createService();

    await expect(
      service.createJob("user-1", {
        projectId: "project-1",
        type: JobType.ANALYZE_VIDEO_FACES,
        payload: { sourceVideoAssetId: "video-1" },
      }),
    ).resolves.toMatchObject({ type: JobType.ANALYZE_VIDEO_FACES });

    expect(queue.enqueue).toHaveBeenCalledWith({
      job_id: "job-1",
      project_id: "project-1",
      type: JobType.ANALYZE_VIDEO_FACES,
      payload: expect.objectContaining({
        sourceVideoAssetId: "video-1",
        sourceVideoAsset: expect.objectContaining({ id: "video-1" }),
      }),
    });
  });

  it("rejects face swap without consent", async () => {
    const { service } = createService();

    await expect(
      service.createJob("user-1", {
        projectId: "project-1",
        type: JobType.FACE_SWAP,
        payload: {
          sourceVideoAssetId: "video-1",
          sourceImageAssetId: "image-1",
          faceAnalysisJobId: "face-analysis-job-1",
          targetIdentityIds: ["person-1"],
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("retries failed jobs by creating a new queued job", async () => {
    const { service, queue } = createService();

    await expect(
      service.retryJob("user-1", "failed-job-1"),
    ).resolves.toMatchObject({
      id: "job-1",
      status: JobStatus.PENDING,
    });

    expect(queue.enqueue).toHaveBeenCalledWith({
      job_id: "job-1",
      project_id: "project-1",
      type: JobType.FACE_SWAP,
      payload: expect.objectContaining({
        sourceVideoAssetId: "video-1",
      }),
    });
  });

  it("creates audio analysis jobs with a serialized source asset", async () => {
    const { service, queue } = createService();

    await expect(
      service.createJob("user-1", {
        projectId: "project-1",
        type: JobType.ANALYZE_AUDIO,
        payload: { audioAssetId: "asset-1" },
      }),
    ).resolves.toMatchObject({
      id: "job-1",
      type: JobType.ANALYZE_AUDIO,
    });

    expect(queue.enqueue).toHaveBeenCalledWith({
      job_id: "job-1",
      project_id: "project-1",
      type: JobType.ANALYZE_AUDIO,
      payload: expect.objectContaining({
        audioAssetId: "asset-1",
        sourceAsset: expect.objectContaining({
          storageKey: audioAsset.storageKey,
        }),
      }),
    });
  });

  it("creates storyboard jobs only from completed audio analysis", async () => {
    const { service, queue } = createService();

    await expect(
      service.createJob("user-1", {
        projectId: "project-1",
        type: JobType.GENERATE_STORYBOARD,
        payload: {
          analysisJobId: "analysis-job-1",
          visualPrompt: "ciudad nocturna",
        },
      }),
    ).resolves.toMatchObject({
      id: "job-1",
      type: JobType.GENERATE_STORYBOARD,
    });

    expect(queue.enqueue).toHaveBeenCalledWith({
      job_id: "job-1",
      project_id: "project-1",
      type: JobType.GENERATE_STORYBOARD,
      payload: expect.objectContaining({
        analysisJobId: "analysis-job-1",
        audioAnalysis: expect.objectContaining({ suggestedScenes: 3 }),
      }),
    });
  });

  it("creates video clip jobs from completed storyboard scenes", async () => {
    const { service, queue } = createService();

    await expect(
      service.createJob("user-1", {
        projectId: "project-1",
        type: JobType.GENERATE_VIDEO_CLIPS,
        payload: {
          storyboardJobId: "storyboard-job-1",
          audioAssetId: "asset-1",
          style: "cinematic",
        },
      }),
    ).resolves.toMatchObject({
      id: "job-1",
      type: JobType.GENERATE_VIDEO_CLIPS,
    });

    expect(queue.enqueue).toHaveBeenCalledWith({
      job_id: "job-1",
      project_id: "project-1",
      type: JobType.GENERATE_VIDEO_CLIPS,
      payload: expect.objectContaining({
        sourceAudioAsset: expect.objectContaining({ id: "asset-1" }),
        storyboard: expect.arrayContaining([
          expect.objectContaining({ sceneIndex: 1 }),
        ]),
      }),
    });
  });

  it("creates final videoclip jobs with ready audio and generated clips", async () => {
    const { service, queue } = createService();

    await expect(
      service.createJob("user-1", {
        projectId: "project-1",
        type: JobType.COMPOSE_VIDEOCLIP,
        payload: {
          audioAssetId: "asset-1",
          clipAssetIds: ["clip-1"],
        },
      }),
    ).resolves.toMatchObject({
      id: "job-1",
      type: JobType.COMPOSE_VIDEOCLIP,
    });

    expect(queue.enqueue).toHaveBeenCalledWith({
      job_id: "job-1",
      project_id: "project-1",
      type: JobType.COMPOSE_VIDEOCLIP,
      payload: expect.objectContaining({
        sourceAudioAsset: expect.objectContaining({
          storageKey: audioAsset.storageKey,
        }),
        clipAssets: expect.arrayContaining([
          expect.objectContaining({ storageKey: clipAsset.storageKey }),
        ]),
      }),
    });
  });

  it("marks processing jobs without progress as failed", async () => {
    const { service, prisma } = createService();
    prisma.processingJob.updateMany.mockResolvedValue({ count: 2 });

    await expect(service.failStaleProcessingJobs(600_000)).resolves.toEqual({
      count: 2,
    });

    expect(prisma.processingJob.updateMany).toHaveBeenCalledWith({
      where: {
        status: JobStatus.PROCESSING,
        updatedAt: { lt: expect.any(Date) },
      },
      data: expect.objectContaining({
        status: JobStatus.FAILED,
        errorMessage: expect.stringContaining("worker"),
      }),
    });
  });

  it("does not revive a cancelled job from a late worker message", async () => {
    const { service, prisma } = createService();
    prisma.processingJob.findUnique.mockResolvedValueOnce({
      id: "cancelled-job",
      status: JobStatus.CANCELLED,
    });

    await expect(
      service.updateJobProgress("cancelled-job", JobStatus.PROCESSING, 50, {
        stage: "animation",
      }),
    ).resolves.toMatchObject({ status: JobStatus.CANCELLED });
    expect(prisma.processingJob.update).not.toHaveBeenCalled();
  });
});
