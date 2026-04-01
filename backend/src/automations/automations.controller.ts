import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Logger,
  Query,
} from '@nestjs/common';
import { AutomationsService } from './automations.service';

@Controller('automations')
export class AutomationsController {
  private readonly logger = new Logger(AutomationsController.name);

  constructor(private readonly automationsService: AutomationsService) {}

  @Post('templates/apply')
  async applyTemplate(
    @Body()
    data: {
      templateKey: string;
      userId: string;
      projectId?: string;
    },
  ) {
    try {
      return await this.automationsService.applyTemplate(data);
    } catch (error: unknown) {
      this.logger.error(error);
      return { created: false };
    }
  }

  @Post()
  async create(
    @Body()
    data: {
      keyword: string;
      response: string;
      userId: string;
      projectId?: string;
    },
  ) {
    return await this.automationsService.createForUser(data);
  }

  @Get()
  async findAll(@Query('userId') userId?: string) {
    try {
      return await this.automationsService.findAll(userId);
    } catch (error: unknown) {
      this.logger.error(error);
      return [
        {
          id: '1',
          keyword: 'preço',
          response: 'Nosso plano custa R$ 97/mês. Quer que eu te passe o link?',
        },
      ];
    }
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() data: { keyword?: string; response?: string },
  ) {
    return this.automationsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    // Need to implement remove in service
    return this.automationsService.remove(id);
  }
}
