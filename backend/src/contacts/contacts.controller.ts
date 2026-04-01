import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Logger,
  Query,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';

@Controller('contacts')
export class ContactsController {
  private readonly logger = new Logger(ContactsController.name);

  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  async create(
    @Body()
    data: {
      name: string;
      phone: string;
      tags?: string[];
      userId: string;
    },
  ) {
    return this.contactsService.createForUser(data);
  }

  @Post('bulk')
  async createMany(
    @Body()
    data: Array<{
      name: string;
      phone: string;
      tags?: string[];
      userId: string;
    }>,
  ) {
    return this.contactsService.createManyForUsers(data);
  }

  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
    @Query('minScore') minScore?: string,
    @Query('tag') tag?: string,
  ) {
    try {
      return await this.contactsService.findAll({
        userId,
        projectId,
        minScore: minScore ? Number(minScore) : undefined,
        tag,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return [
        {
          id: '1',
          name: 'João Silva',
          phone: '+55 11 99999-9999',
          tags: ['vip'],
        },
        {
          id: '2',
          name: 'Maria Souza',
          phone: '+55 11 88888-8888',
          tags: ['lead'],
        },
      ];
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body()
    updateContactDto: { name?: string; phone?: string; tags?: string[] },
  ) {
    return this.contactsService.update(id, updateContactDto);
  }

  @Delete('bulk')
  removeMany(@Body('ids') ids: string[]) {
    return this.contactsService.removeMany(ids);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contactsService.remove(id);
  }
}
