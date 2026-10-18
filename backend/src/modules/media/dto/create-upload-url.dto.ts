import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { MediaAssetKind } from "@prisma/client";

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
  @Max(1024 * 1024 * 1024) // 1GB for full-length source videos
  sizeBytes?: number;
}

export class ConfirmUploadDto {
  @IsNumber()
  @IsOptional()
  durationSeconds?: number;
}
