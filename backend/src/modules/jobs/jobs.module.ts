import { Module } from '@nestjs/common';
import { JobsController } from './controllers/jobs.controller';
import { JobsService } from './services/jobs.service';
import { JobQueueService } from './services/job-queue.service';

@Module({
  controllers: [JobsController],
  providers: [JobsService, JobQueueService],
  exports: [JobsService, JobQueueService],
})
export class JobsModule {}
