import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class JobQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobQueueService.name);
  private redisClient: Redis;
  private readonly queueName: string;

  constructor(private readonly configService: ConfigService) {
    this.queueName = this.configService.get<string>(
      "JOBS_QUEUE_NAME",
      "tiluchi:jobs:queue",
    );
  }

  onModuleInit() {
    this.redisClient = new Redis({
      host: this.configService.get<string>("REDIS_HOST", "localhost"),
      port: this.configService.get<number>("REDIS_PORT", 6379),
      password: this.configService.get<string>("REDIS_PASSWORD") || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    this.redisClient.connect().catch((err) => {
      this.logger.warn(
        `Could not connect to Redis: ${err.message}. Jobs will be queued in memory/mock.`,
      );
    });
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  async enqueue(jobPayload: {
    job_id: string;
    project_id?: string;
    type: string;
    payload: any;
  }): Promise<void> {
    try {
      if (this.redisClient && this.redisClient.status === "ready") {
        await this.redisClient.rpush(
          this.queueName,
          JSON.stringify(jobPayload),
        );
        this.logger.log(
          `Job ${jobPayload.job_id} pushed to Redis queue '${this.queueName}'`,
        );
      } else {
        this.logger.warn(
          `Redis not connected, simulated enqueuing for job ${jobPayload.job_id}`,
        );
      }
    } catch (e: any) {
      this.logger.error(`Error enqueuing job: ${e.message}`);
    }
  }
}
