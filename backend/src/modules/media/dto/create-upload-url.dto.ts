import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { MediaAssetKind } from '@prisma/client';

export class RequestUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsEnum(MediaAssetKind)
  kind: MediaAssetKind;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100 * 1024 * 1024) // 100MB limit for MVP
  sizeBytes?: number;
}

export class ConfirmUploadDto {
  @IsNumber()
  @IsOptional()
  durationSeconds?: number;
}
