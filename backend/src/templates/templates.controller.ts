import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';

@Controller('templates')
export class TemplatesController {
  private readonly logger = new Logger(TemplatesController.name);

  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  async list(
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
  ) {
    if (!userId) return [];
    try {
      return await this.templatesService.list({ userId, projectId });
    } catch (error: unknown) {
      this.logger.error(error);
      return [];
    }
  }

  @Post()
  async create(
    @Body()
    data: {
      userId: string;
      projectId?: string;
      name: string;
      content: string;
    },
  ) {
    if (!data?.userId) return { created: false };
    try {
      return await this.templatesService.create(data);
    } catch (error: unknown) {
      this.logger.error(error);
      return { created: false };
    }
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    data: {
      userId: string;
      projectId?: string;
      name?: string;
      content?: string;
    },
  ) {
    if (!data?.userId) return { updated: false };
    try {
      return await this.templatesService.update({ id, ...data });
    } catch (error: unknown) {
      this.logger.error(error);
      return { updated: false };
    }
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
  ) {
    if (!userId) return { deleted: false };
    try {
      return await this.templatesService.remove({ id, userId, projectId });
    } catch (error: unknown) {
      this.logger.error(error);
      return { deleted: false };
    }
  }
}
