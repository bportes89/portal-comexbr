import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Logger,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { Prisma } from '@prisma/client';

@Controller('contacts')
export class ContactsController {
  private readonly logger = new Logger(ContactsController.name);

  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  create(@Body() createContactDto: Prisma.ContactCreateInput) {
    return this.contactsService.create(createContactDto);
  }

  @Post('bulk')
  createMany(@Body() createContactDtos: Prisma.ContactCreateManyInput[]) {
    return this.contactsService.createMany(createContactDtos);
  }

  @Get()
  async findAll() {
    try {
      return await this.contactsService.findAll();
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
    @Body() updateContactDto: Prisma.ContactUpdateInput,
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
