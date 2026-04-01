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

  private async ensureProjectAccess(params: {
    userId: string;
    projectId: string;
  }) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: params.projectId,
        OR: [
          { ownerId: params.userId },
          { members: { some: { userId: params.userId } } },
        ],
      },
      select: { id: true },
    });
    if (!project) throw new Error('Access denied to project');
    return project;
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

  async findAll(userId?: string): Promise<unknown[]>;
  async findAll(data?: {
    userId?: string;
    projectId?: string;
    minScore?: number;
    tag?: string;
  }): Promise<unknown[]>;
  async findAll(
    arg?:
      | string
      | {
          userId?: string;
          projectId?: string;
          minScore?: number;
          tag?: string;
        },
  ) {
    const data = typeof arg === 'string' ? { userId: arg } : (arg ?? {});
    try {
      if (data.projectId && data.userId) {
        await this.ensureProjectAccess({
          userId: data.userId,
          projectId: data.projectId,
        });
      }
      const where: Record<string, unknown> = {};
      if (data.userId) where.userId = data.userId;
      if (data.projectId) where.projectId = data.projectId;
      if (data.minScore !== undefined && !Number.isNaN(data.minScore)) {
        where.score = { gte: data.minScore };
      }
      if (data.tag) {
        where.tags = { has: data.tag };
      }
      return await this.prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      if (data.userId) return this.ensureDemoContacts(data.userId);
      const all = Array.from(
        ContactsService.demoContactsByUser.values(),
      ).flat();
      if (all.length > 0) return all;
      return this.ensureDemoContacts('mock-user-id');
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
      score: 0,
      userId: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prev = ContactsService.demoContactsByUser.get(data.userId) ?? [];
    ContactsService.demoContactsByUser.set(data.userId, [contact, ...prev]);
    return contact;
  }

  private ensureDemoContacts(userId: string): ContactRecord[] {
    const existing = ContactsService.demoContactsByUser.get(userId);
    if (existing && existing.length > 0) return existing;

    const demo: ContactRecord[] = [
      {
        id: randomUUID(),
        name: 'João Silva',
        phone: '+55 11 99999-9999',
        tags: ['vip'],
        score: 10,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        name: 'Maria Souza',
        phone: '+55 11 88888-8888',
        tags: ['lead'],
        score: 0,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    ContactsService.demoContactsByUser.set(userId, demo);
    return demo;
  }
}

type ContactRecord = {
  id: string;
  name: string;
  phone: string;
  tags: string[];
  score: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};
