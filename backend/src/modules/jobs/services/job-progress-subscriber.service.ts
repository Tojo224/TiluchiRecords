import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JobStatus } from "@prisma/client";
import Redis from "ioredis";
import { JobsService } from "./jobs.service";

type ProgressMessage = {
  job_id?: string;
  status?: JobStatus;
  progress?: number;
  result?: unknown;
  error?: string;
};

@Injectable()
export class JobProgressSubscriberService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(JobProgressSubscriberService.name);
  private redisClient: Redis;
  private readonly channel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly jobsService: JobsService,
  ) {
    this.channel = this.configService.get<string>(
      "JOBS_PROGRESS_CHANNEL",
      "tiluchi:jobs:progress",
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

    this.redisClient.on("message", (_channel, message) =>
      this.handleMessage(message),
    );
    this.redisClient
      .connect()
      .then(() => this.redisClient.subscribe(this.channel))
      .then(() =>
        this.logger.log(
          `Subscribed to Redis job progress channel '${this.channel}'`,
        ),
      )
      .catch((err) => {
        this.logger.warn(
          `Could not subscribe to Redis progress channel: ${err.message}`,
        );
      });
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  private async handleMessage(message: string) {
    try {
      const parsed = JSON.parse(message) as ProgressMessage;

      if (
        !parsed.job_id ||
        !parsed.status ||
        typeof parsed.progress !== "number"
      ) {
        this.logger.warn(`Ignoring invalid progress message: ${message}`);
        return;
      }

      const progress = Math.max(0, Math.min(100, Math.round(parsed.progress)));
      await this.jobsService.updateJobProgress(
        parsed.job_id,
        parsed.status,
        progress,
        parsed.result,
        parsed.error,
      );
    } catch (err: any) {
      this.logger.warn(`Could not process progress message: ${err.message}`);
    }
  }
}
