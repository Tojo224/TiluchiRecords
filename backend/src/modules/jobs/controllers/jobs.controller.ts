import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { JobsService } from '../services/jobs.service';
import { CreateJobDto } from '../dto/create-job.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  createJob(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateJobDto,
  ) {
    return this.jobsService.createJob(userId, dto);
  }

  // Polling endpoint for client (HU-05)
  @Get(':id')
  getJob(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.jobsService.getJob(userId, id);
  }
}
