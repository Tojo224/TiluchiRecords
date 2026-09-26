import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { JobType } from '@prisma/client';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsEnum(JobType)
  type: JobType;

  @IsObject()
  @IsOptional()
  payload?: Record<string, any>;
}
