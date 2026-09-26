import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { JobQueueService } from './job-queue.service';
import { CreateJobDto } from '../dto/create-job.dto';
import { JobStatus } from '@prisma/client';

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
      throw new ForbiddenException('You do not own this project');
    }

    const job = await this.prisma.processingJob.create({
      data: {
        projectId: dto.projectId,
        type: dto.type,
        status: JobStatus.PENDING,
        progress: 0,
        payload: dto.payload || {},
      },
    });

    // Enqueue job to Redis for Python worker consumption
    await this.queueService.enqueue({
      job_id: job.id,
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
        stages: { orderBy: { startedAt: 'asc' } },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    if (job.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this job');
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

  async updateJobProgress(jobId: string, status: JobStatus, progress: number, result?: any, error?: string) {
    return this.prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status,
        progress,
        result: result ?? undefined,
        errorMessage: error ?? undefined,
      },
    });
  }
}
