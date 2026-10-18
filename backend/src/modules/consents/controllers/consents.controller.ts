import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CreateFaceSwapConsentDto } from "../dto/create-face-swap-consent.dto";
import { ConsentsService } from "../services/consents.service";

@Controller("consents")
@UseGuards(JwtAuthGuard)
export class ConsentsController {
  constructor(private readonly consentsService: ConsentsService) {}

  @Post("face-swap")
  createFaceSwapConsent(
    @CurrentUser("id") userId: string,
    @Body() dto: CreateFaceSwapConsentDto,
    @Req() request: Request,
  ) {
    return this.consentsService.createFaceSwapConsent(userId, dto, {
      ipAddress: request.ip,
      userAgent: request.get("user-agent"),
    });
  }
}
