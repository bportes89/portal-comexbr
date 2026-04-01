import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Logger,
  Query,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';

@Controller('campaigns')
export class CampaignsController {
  private readonly logger = new Logger(CampaignsController.name);

  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  async create(
    @Body()
    data: {
      name: string;
      message: string;
      userId: string;
      projectId?: string;
      contactIds: string[];
      instanceName: string;
      delay?: number;
      scheduledAt?: string;
      sendWindowStartMin?: number;
      sendWindowEndMin?: number;
    },
  ) {
    try {
      const scheduledAt =
        typeof data.scheduledAt === 'string' && data.scheduledAt.length > 0
          ? new Date(data.scheduledAt)
          : undefined;
      return await this.campaignsService.createCampaign({
        ...data,
        scheduledAt:
          scheduledAt && !Number.isNaN(scheduledAt.getTime())
            ? scheduledAt
            : undefined,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return this.campaignsService.createCampaignInMemory(data);
    }
  }

  @Get()
  async findAll(@Query('userId') userId?: string) {
    try {
      return await this.campaignsService.findAll(userId);
    } catch (error: unknown) {
      this.logger.error(error);
      const now = new Date().toISOString();
      return [
        {
          id: '1',
          name: 'Welcome Series',
          message: 'Olá! Bem-vindo ao Portal ComexBr.',
          status: 'sending',
          createdAt: now,
          stats: { sent: 120, delivered: 115, read: 90, failed: 5 },
        },
        {
          id: '2',
          name: 'Black Friday Promo',
          message: 'Não perca nossas ofertas!',
          status: 'scheduled',
          createdAt: now,
          scheduledFor: new Date(Date.now() + 86400000).toISOString(),
          stats: { sent: 0, delivered: 0, read: 0, failed: 0 },
        },
      ];
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      return await this.campaignsService.remove(id);
    } catch (error: unknown) {
      this.logger.error(error);
      return { id, deleted: false };
    }
  }
}
