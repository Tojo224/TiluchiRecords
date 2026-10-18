import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateProjectDto, UpdateProjectDto } from "../dto/create-project.dto";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async findAllByUser(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: {
            mediaAssets: {
              where: { kind: { not: "PROJECT_COVER_IMAGE" } },
            },
            jobs: true,
          },
        },
        mediaAssets: {
          where: {
            kind: "PROJECT_COVER_IMAGE",
            status: "READY",
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return projects.map(({ mediaAssets, ...project }) => ({
      ...project,
      coverImage: mediaAssets[0]
        ? {
            ...mediaAssets[0],
            sizeBytes: mediaAssets[0].sizeBytes?.toString() ?? null,
          }
        : null,
    }));
  }

  async findOne(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        mediaAssets: {
          orderBy: { createdAt: "desc" },
        },
        jobs: {
          orderBy: { createdAt: "desc" },
          include: { stages: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (project.userId !== userId) {
      throw new ForbiddenException(
        "Access denied: You do not own this project",
      );
    }

    const serializedAssets = project.mediaAssets.map((asset) => ({
      ...asset,
      sizeBytes: asset.sizeBytes?.toString() ?? null,
    }));

    return {
      ...project,
      mediaAssets: serializedAssets,
      coverImage:
        serializedAssets.find(
          (asset) =>
            asset.kind === "PROJECT_COVER_IMAGE" && asset.status === "READY",
        ) ?? null,
    };
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    await this.findOne(userId, projectId); // Validates existence and ownership

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async remove(userId: string, projectId: string) {
    await this.findOne(userId, projectId); // Validates existence and ownership

    return this.prisma.project.delete({
      where: { id: projectId },
    });
  }
}
