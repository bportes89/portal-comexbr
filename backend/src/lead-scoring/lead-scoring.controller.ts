import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeadScoringService } from './lead-scoring.service';

@Controller()
export class LeadScoringController {
  private readonly logger = new Logger(LeadScoringController.name);
  private static rate = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly leadScoringService: LeadScoringService,
    private readonly configService: ConfigService,
  ) {}

  @Post('lead-scoring/rules')
  async createRule(
    @Body()
    data: {
      userId: string;
      projectId?: string;
      name?: string;
      eventType: string;
      points: number;
      conditions?: Record<string, unknown>;
    },
  ) {
    try {
      return await this.leadScoringService.createRule(data);
    } catch (error: unknown) {
      this.logger.error(error);
      return { created: false };
    }
  }

  @Get('lead-scoring/rules')
  async listRules(
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
  ) {
    try {
      return await this.leadScoringService.listRules({ userId, projectId });
    } catch (error: unknown) {
      this.logger.error(error);
      return [];
    }
  }

  @Delete('lead-scoring/rules/:id')
  async deleteRule(@Param('id') id: string) {
    try {
      return await this.leadScoringService.deleteRule(id);
    } catch (error: unknown) {
      this.logger.error(error);
      return { id, deleted: false };
    }
  }

  @Post('events/ingest')
  async ingest(
    @Body()
    data: {
      userId: string;
      projectId?: string;
      type: string;
      source?: string;
      contactId?: string;
      phone?: string;
      metadata?: Record<string, unknown>;
    },
    @Headers('x-ingest-token') ingestToken?: string,
  ) {
    const expected = this.configService.get<string>('EVENTS_INGEST_TOKEN');
    if (expected && expected !== ingestToken) return { ingested: false };
    const key = `events:${ingestToken ?? 'no-token'}`;
    const now = Date.now();
    const windowMs = 60_000;
    const limit = 120;
    const existing = LeadScoringController.rate.get(key);
    if (!existing || existing.resetAt <= now) {
      LeadScoringController.rate.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
    } else {
      existing.count += 1;
      if (existing.count > limit) return { ingested: false };
    }
    try {
      return await this.leadScoringService.ingestEvent(data);
    } catch (error: unknown) {
      this.logger.error(error);
      return { ingested: false };
    }
  }

  @Get('events')
  async listEvents(
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
    @Query('contactId') contactId?: string,
    @Query('type') type?: string,
    @Query('take') take?: string,
  ) {
    try {
      return await this.leadScoringService.listEvents({
        userId,
        projectId,
        contactId,
        type,
        take: take ? Number(take) : undefined,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return [];
    }
  }
}
