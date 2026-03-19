import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  create(data: Prisma.ContactCreateInput) {
    return this.prisma.contact.create({ data });
  }

  createMany(data: Prisma.ContactCreateManyInput[]) {
    return this.prisma.contact.createMany({ data });
  }

  findAll() {
    return this.prisma.contact.findMany();
  }

  findOne(id: string) {
    return this.prisma.contact.findUnique({ where: { id } });
  }

  update(id: string, data: Prisma.ContactUpdateInput) {
    return this.prisma.contact.update({
      where: { id },
      data,
    });
  }

  remove(id: string) {
    return this.prisma.contact.delete({ where: { id } });
  }

  removeMany(ids: string[]) {
    return this.prisma.contact.deleteMany({
      where: {
        id: { in: ids },
      },
    });
  }
}
