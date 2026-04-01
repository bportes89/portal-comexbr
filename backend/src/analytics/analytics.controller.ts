import { Controller, Get, Logger, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async overview(
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!userId) return { totals: {} };
    try {
      const fromDate = from ? new Date(from) : undefined;
      const toDate = to ? new Date(to) : undefined;

      return await this.analyticsService.getOverview({
        userId,
        projectId,
        from:
          fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : undefined,
        to: toDate && !Number.isNaN(toDate.getTime()) ? toDate : undefined,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { totals: {} };
    }
  }

  @Get('messages-breakdown')
  async messagesBreakdown(
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('instanceName') instanceName?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    if (!userId) return { totalsByStatus: {}, byInstance: {}, byCampaign: [] };
    try {
      const fromDate = from ? new Date(from) : undefined;
      const toDate = to ? new Date(to) : undefined;
      return await this.analyticsService.getMessageBreakdown({
        userId,
        projectId,
        instanceName,
        campaignId,
        from:
          fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : undefined,
        to: toDate && !Number.isNaN(toDate.getTime()) ? toDate : undefined,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { totalsByStatus: {}, byInstance: {}, byCampaign: [] };
    }
  }

  @Get('failures')
  async failures(
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('instanceName') instanceName?: string,
    @Query('campaignId') campaignId?: string,
    @Query('take') take?: string,
  ) {
    if (!userId) return { items: [] };
    try {
      const fromDate = from ? new Date(from) : undefined;
      const toDate = to ? new Date(to) : undefined;
      const takeNum = take ? Number(take) : 50;
      const safeTake =
        Number.isFinite(takeNum) && takeNum > 0 ? Math.min(takeNum, 200) : 50;

      return await this.analyticsService.getFailures({
        userId,
        projectId,
        instanceName,
        campaignId,
        take: safeTake,
        from:
          fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : undefined,
        to: toDate && !Number.isNaN(toDate.getTime()) ? toDate : undefined,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { items: [] };
    }
  }

  @Get('groups-breakdown')
  async groupsBreakdown(
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('instanceName') instanceName?: string,
  ) {
    if (!userId) return { items: [] };
    try {
      const fromDate = from ? new Date(from) : undefined;
      const toDate = to ? new Date(to) : undefined;
      return await this.analyticsService.getGroupBreakdown({
        userId,
        projectId,
        instanceName,
        from:
          fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : undefined,
        to: toDate && !Number.isNaN(toDate.getTime()) ? toDate : undefined,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { items: [] };
    }
  }
}
