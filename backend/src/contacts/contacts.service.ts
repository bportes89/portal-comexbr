import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class ContactsService {
  private static demoContactsByUser = new Map<string, ContactRecord[]>();

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
    try {
      await this.ensureUser(data.userId);
      return await this.prisma.contact.create({
        data: {
          name: data.name,
          phone: data.phone,
          tags: data.tags ?? [],
          user: { connect: { id: data.userId } },
        },
      });
    } catch {
      return this.createInMemory(data);
    }
  }

  async createManyForUsers(
    data: Array<{
      name: string;
      phone: string;
      tags?: string[];
      userId: string;
    }>,
  ) {
    try {
      const userIds = Array.from(new Set(data.map((c) => c.userId)));
      await Promise.all(userIds.map((id) => this.ensureUser(id)));

      return await this.prisma.contact.createMany({
        data: data.map((c) => ({
          name: c.name,
          phone: c.phone,
          tags: c.tags ?? [],
          userId: c.userId,
        })),
      });
    } catch {
      const created = data.map((c) => this.createInMemory(c));
      return { count: created.length };
    }
  }

  async findAll(userId?: string) {
    try {
      if (userId)
        return await this.prisma.contact.findMany({ where: { userId } });
      return await this.prisma.contact.findMany();
    } catch {
      if (userId) return ContactsService.demoContactsByUser.get(userId) ?? [];
      return Array.from(ContactsService.demoContactsByUser.values()).flat();
    }
  }

  async findOne(id: string) {
    try {
      return await this.prisma.contact.findUnique({ where: { id } });
    } catch {
      for (const contacts of ContactsService.demoContactsByUser.values()) {
        const found = contacts.find((c) => c.id === id);
        if (found) return found;
      }
      return null;
    }
  }

  async update(
    id: string,
    data: { name?: string; phone?: string; tags?: string[] },
  ) {
    try {
      return await this.prisma.contact.update({
        where: { id },
        data,
      });
    } catch {
      for (const [
        userId,
        contacts,
      ] of ContactsService.demoContactsByUser.entries()) {
        const idx = contacts.findIndex((c) => c.id === id);
        if (idx === -1) continue;
        const updated: ContactRecord = {
          ...contacts[idx],
          name: data.name ?? contacts[idx].name,
          phone: data.phone ?? contacts[idx].phone,
          tags: data.tags ?? contacts[idx].tags,
          updatedAt: new Date(),
        };
        const next = [...contacts];
        next[idx] = updated;
        ContactsService.demoContactsByUser.set(userId, next);
        return updated;
      }
      throw new Error('Contact not found');
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.contact.delete({ where: { id } });
    } catch {
      for (const [
        userId,
        contacts,
      ] of ContactsService.demoContactsByUser.entries()) {
        const idx = contacts.findIndex((c) => c.id === id);
        if (idx === -1) continue;
        const removed = contacts[idx];
        const next = contacts.filter((c) => c.id !== id);
        ContactsService.demoContactsByUser.set(userId, next);
        return removed;
      }
      throw new Error('Contact not found');
    }
  }

  async removeMany(ids: string[]) {
    try {
      return await this.prisma.contact.deleteMany({
        where: {
          id: { in: ids },
        },
      });
    } catch {
      let removedCount = 0;
      for (const [
        userId,
        contacts,
      ] of ContactsService.demoContactsByUser.entries()) {
        const next = contacts.filter((c) => !ids.includes(c.id));
        removedCount += contacts.length - next.length;
        ContactsService.demoContactsByUser.set(userId, next);
      }
      return { count: removedCount };
    }
  }

  private createInMemory(data: {
    name: string;
    phone: string;
    tags?: string[];
    userId: string;
  }): ContactRecord {
    const contact: ContactRecord = {
      id: randomUUID(),
      name: data.name,
      phone: data.phone,
      tags: data.tags ?? [],
      userId: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prev = ContactsService.demoContactsByUser.get(data.userId) ?? [];
    ContactsService.demoContactsByUser.set(data.userId, [contact, ...prev]);
    return contact;
  }
}

type ContactRecord = {
  id: string;
  name: string;
  phone: string;
  tags: string[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};
