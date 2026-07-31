import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';

@Injectable()
export class CampaignsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignsScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly campaignsService: CampaignsService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.campaignsService.processDueScheduledCampaigns().catch((error) => {
        this.logger.error(error);
      });
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
