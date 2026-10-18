import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JobsService } from "./jobs.service";

@Injectable()
export class JobWatchdogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobWatchdogService.name);
  private timer?: NodeJS.Timeout;
  private readonly staleAfterMs: number;
  private readonly checkEveryMs: number;

  constructor(
    configService: ConfigService,
    private readonly jobsService: JobsService,
  ) {
    this.staleAfterMs = configService.get<number>(
      "JOB_STALE_TIMEOUT_MS",
      10 * 60 * 1000,
    );
    this.checkEveryMs = configService.get<number>(
      "JOB_WATCHDOG_INTERVAL_MS",
      30 * 1000,
    );
  }

  onModuleInit() {
    this.timer = setInterval(() => void this.check(), this.checkEveryMs);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async check() {
    try {
      const result = await this.jobsService.failStaleProcessingJobs(
        this.staleAfterMs,
      );
      if (result.count > 0) {
        this.logger.warn(
          `Marked ${result.count} stale processing job(s) as failed`,
        );
      }
    } catch (error: any) {
      this.logger.warn(`Could not check stale jobs: ${error.message}`);
    }
  }
}
