import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { MediaService } from '../services/media.service';
import { RequestUploadUrlDto, ConfirmUploadDto } from '../dto/create-upload-url.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-url')
  requestUploadUrl(
    @CurrentUser('id') userId: string,
    @Body() dto: RequestUploadUrlDto,
  ) {
    return this.mediaService.requestUploadUrl(userId, dto);
  }

  @Post(':id/confirm')
  confirmUpload(
    @CurrentUser('id') userId: string,
    @Param('id') assetId: string,
    @Body() dto: ConfirmUploadDto,
  ) {
    return this.mediaService.confirmUpload(userId, assetId, dto);
  }

  @Get(':id/download-url')
  getDownloadUrl(
    @CurrentUser('id') userId: string,
    @Param('id') assetId: string,
  ) {
    return this.mediaService.getDownloadUrl(userId, assetId);
  }
}
