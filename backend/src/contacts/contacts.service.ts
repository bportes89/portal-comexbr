import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  private async ensureUser(userId: string) {
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@demo.portal-comexbr.local`,
        password: 'demo',
        name: 'Demo User',
      },
    });
  }

  async createForUser(data: {
    name: string;
    phone: string;
    tags?: string[];
    userId: string;
  }) {
    await this.ensureUser(data.userId);
    return this.prisma.contact.create({
      data: {
        name: data.name,
        phone: data.phone,
        tags: data.tags ?? [],
        user: { connect: { id: data.userId } },
      },
    });
  }

  async createManyForUsers(
    data: Array<{ name: string; phone: string; tags?: string[]; userId: string }>,
  ) {
    const userIds = Array.from(new Set(data.map((c) => c.userId)));
    await Promise.all(userIds.map((id) => this.ensureUser(id)));

    return this.prisma.contact.createMany({
      data: data.map((c) => ({
        name: c.name,
        phone: c.phone,
        tags: c.tags ?? [],
        userId: c.userId,
      })),
    });
  }

  findAll(userId?: string) {
    if (userId) return this.prisma.contact.findMany({ where: { userId } });
    return this.prisma.contact.findMany();
  }

  findOne(id: string) {
    return this.prisma.contact.findUnique({ where: { id } });
  }

  update(id: string, data: { name?: string; phone?: string; tags?: string[] }) {
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
