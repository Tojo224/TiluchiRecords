import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateFaceSwapConsentDto } from "../dto/create-face-swap-consent.dto";

@Injectable()
export class ConsentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createFaceSwapConsent(
    userId: string,
    dto: CreateFaceSwapConsentDto,
    requestMetadata: { ipAddress?: string; userAgent?: string },
  ) {
    if (!dto.termsAccepted) {
      throw new BadRequestException("Face swap consent must be accepted");
    }

    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    if (project.userId !== userId) {
      throw new ForbiddenException("You do not own this project");
    }

    return this.prisma.consentLog.create({
      data: {
        userId,
        projectId: dto.projectId,
        termsAccepted: true,
        consentText: dto.consentText,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      },
    });
  }
}
