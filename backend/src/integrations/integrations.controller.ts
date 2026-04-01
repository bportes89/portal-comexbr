import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);
  private static rate = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('incoming-endpoints')
  async createIncomingEndpoint(
    @Body()
    data: {
      userId: string;
      projectId?: string;
      name: string;
      provider?: string;
      mapping?: Record<string, unknown>;
    },
  ) {
    try {
      return await this.integrationsService.createIncomingEndpoint({
        userId: data.userId,
        projectId: data.projectId,
        name: data.name,
        provider: data.provider,
        mapping: data.mapping,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { created: false };
    }
  }

  @Get('incoming-endpoints')
  async listIncomingEndpoints(
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
  ) {
    if (!userId) return [];
    try {
      return await this.integrationsService.listIncomingEndpoints({
        userId,
        projectId,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return [];
    }
  }

  @Delete('incoming-endpoints/:id')
  async deleteIncomingEndpoint(
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ) {
    if (!userId) return { id, deleted: false };
    try {
      return await this.integrationsService.deleteIncomingEndpoint({
        id,
        userId,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { id, deleted: false };
    }
  }

  @Post('outgoing-webhooks')
  async createOutgoingWebhook(
    @Body()
    data: {
      userId: string;
      projectId?: string;
      name: string;
      url: string;
      eventTypes: string[];
      secret?: string;
    },
  ) {
    try {
      return await this.integrationsService.createOutgoingSubscription(data);
    } catch (error: unknown) {
      this.logger.error(error);
      return { created: false };
    }
  }

  @Get('outgoing-webhooks')
  async listOutgoingWebhooks(
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
  ) {
    if (!userId) return [];
    try {
      return await this.integrationsService.listOutgoingSubscriptions({
        userId,
        projectId,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return [];
    }
  }

  @Delete('outgoing-webhooks/:id')
  async deleteOutgoingWebhook(
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ) {
    if (!userId) return { id, deleted: false };
    try {
      return await this.integrationsService.deleteOutgoingSubscription({
        id,
        userId,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { id, deleted: false };
    }
  }

  @Post('in/:token')
  async receiveIncoming(
    @Param('token') token: string,
    @Body() payload: unknown,
  ) {
    const key = `in:${token}`;
    const now = Date.now();
    const windowMs = 60_000;
    const limit = 120;
    const existing = IntegrationsController.rate.get(key);
    if (!existing || existing.resetAt <= now) {
      IntegrationsController.rate.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
    } else {
      existing.count += 1;
      if (existing.count > limit) return { received: false };
    }

    return await this.integrationsService.receiveIncomingWebhook(
      token,
      payload,
    );
  }
}
