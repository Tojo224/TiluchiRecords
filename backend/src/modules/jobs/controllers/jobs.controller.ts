import { Controller, Post, Get, Param, Body, UseGuards } from "@nestjs/common";
import { JobsService } from "../services/jobs.service";
import { CreateJobDto } from "../dto/create-job.dto";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";

@Controller("jobs")
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  createJob(@CurrentUser("id") userId: string, @Body() dto: CreateJobDto) {
    return this.jobsService.createJob(userId, dto);
  }

  @Get("project/:projectId")
  findByProject(
    @CurrentUser("id") userId: string,
    @Param("projectId") projectId: string,
  ) {
    return this.jobsService.findByProject(userId, projectId);
  }

  // Polling endpoint for client (HU-15)
  @Get(":id")
  getJob(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.jobsService.getJob(userId, id);
  }

  @Post(":id/retry")
  retryJob(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.jobsService.retryJob(userId, id);
  }
}
