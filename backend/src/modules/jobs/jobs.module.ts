import { Module } from "@nestjs/common";
import { JobsController } from "./controllers/jobs.controller";
import { JobsService } from "./services/jobs.service";
import { JobQueueService } from "./services/job-queue.service";
import { JobProgressSubscriberService } from "./services/job-progress-subscriber.service";
import { JobWatchdogService } from "./services/job-watchdog.service";

@Module({
  controllers: [JobsController],
  providers: [
    JobsService,
    JobQueueService,
    JobProgressSubscriberService,
    JobWatchdogService,
  ],
  exports: [JobsService, JobQueueService],
})
export class JobsModule {}
