import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';

@Injectable()
export class CampaignsService {
  private static demoCampaignsByUser = new Map<string, CampaignRecord[]>();

  constructor(
    private prisma: PrismaService,
    @InjectQueue('whatsapp-queue') private whatsappQueue: Queue,
  ) {}

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

  private renderTemplate(
    template: string,
    data: { name?: string; phone?: string; score?: number; tags?: string[] },
  ) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
      const k = String(key ?? '').toLowerCase();
      if (k === 'name' || k === 'contact.name') return data.name ?? '';
      if (k === 'phone' || k === 'contact.phone') return data.phone ?? '';
      if (k === 'score' || k === 'contact.score')
        return typeof data.score === 'number' ? String(data.score) : '';
      if (k === 'tags' || k === 'contact.tags')
        return Array.isArray(data.tags) ? data.tags.join(', ') : '';
      return '';
    });
  }

  private computeNextAllowedStart(params: {
    base: Date;
    startMin?: number;
    endMin?: number;
  }) {
    const startMin =
      typeof params.startMin === 'number' &&
      Number.isFinite(params.startMin) &&
      params.startMin >= 0 &&
      params.startMin < 1440
        ? Math.floor(params.startMin)
        : undefined;
    const endMin =
      typeof params.endMin === 'number' &&
      Number.isFinite(params.endMin) &&
      params.endMin >= 0 &&
      params.endMin < 1440
        ? Math.floor(params.endMin)
        : undefined;
    if (startMin === undefined || endMin === undefined) return params.base;

    const base = new Date(params.base);
    const currentMin = base.getHours() * 60 + base.getMinutes();

    const isAllowed =
      startMin <= endMin
        ? currentMin >= startMin && currentMin <= endMin
        : currentMin >= startMin || currentMin <= endMin;
    if (isAllowed) return base;

    const next = new Date(base);
    if (startMin <= endMin) {
      if (currentMin < startMin) {
        next.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
      } else {
        next.setDate(next.getDate() + 1);
        next.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
      }
      return next;
    }

    next.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
    if (currentMin > endMin && currentMin < startMin) {
      return next;
    }
    return next;
  }

  async createCampaign(data: {
    name: string;
    message: string;
    userId: string;
    projectId?: string;
    contactIds: string[];
    instanceName: string;
    delay?: number;
    scheduledAt?: Date;
    sendWindowStartMin?: number;
    sendWindowEndMin?: number;
  }) {
    await this.ensureUser(data.userId);
    if (data.projectId) {
      await this.ensureProjectAccess({
        userId: data.userId,
        projectId: data.projectId,
      });
    }

    const now = new Date();
    const baseRequested = data.scheduledAt ? data.scheduledAt : now;
    const baseAllowed = this.computeNextAllowedStart({
      base: baseRequested,
      startMin: data.sendWindowStartMin,
      endMin: data.sendWindowEndMin,
    });
    const base = baseAllowed.getTime() < now.getTime() ? now : baseAllowed;
    const startDelayMs = Math.max(0, base.getTime() - now.getTime());

    // 1. Create Campaign in DB
    const campaign = await this.prisma.campaign.create({
      data: {
        name: data.name,
        message: data.message,
        userId: data.userId,
        projectId: data.projectId,
        status: startDelayMs > 0 ? 'SCHEDULED' : 'PROCESSING',
        instanceName: data.instanceName,
        ...(startDelayMs > 0 ? { scheduledAt: base } : {}),
        ...(typeof data.sendWindowStartMin === 'number'
          ? { sendWindowStartMin: Math.floor(data.sendWindowStartMin) }
          : {}),
        ...(typeof data.sendWindowEndMin === 'number'
          ? { sendWindowEndMin: Math.floor(data.sendWindowEndMin) }
          : {}),
      },
    });

    // 2. Create Message records and add jobs to Queue for each contact
    // Fetch contacts to get their phone numbers
    const contacts = await this.prisma.contact.findMany({
      where: {
        id: { in: data.contactIds },
        userId: data.userId,
        ...(data.projectId ? { projectId: data.projectId } : {}),
        NOT: { tags: { has: 'system:optout' } },
      },
    });

    const perMessageDelayMs =
      typeof data.delay === 'number' ? data.delay : 5000;
    const scheduleTimes: Date[] = [];
    let cursor = base;
    for (let i = 0; i < contacts.length; i += 1) {
      const candidate =
        i === 0 ? base : new Date(cursor.getTime() + perMessageDelayMs);
      const adjusted = this.computeNextAllowedStart({
        base: candidate,
        startMin: data.sendWindowStartMin,
        endMin: data.sendWindowEndMin,
      });
      cursor = adjusted;
      scheduleTimes.push(adjusted);
    }

    const jobs = await Promise.all(
      contacts.map(async (contact, index) => {
        const rendered = this.renderTemplate(data.message, {
          name: contact.name,
          phone: contact.phone,
          score: contact.score,
          tags: contact.tags,
        });

        const message = await this.prisma.message.create({
          data: {
            content: rendered,
            status: 'PENDING',
            campaignId: campaign.id,
            contactId: contact.id,
            instanceName: data.instanceName,
          },
        });

        const scheduledTime = scheduleTimes[index] ?? base;
        const delayMs = Math.max(0, scheduledTime.getTime() - now.getTime());

        return {
          name: 'sendMessage',
          data: {
            instanceName: data.instanceName,
            number: contact.phone,
            text: rendered,
            messageId: message.id,
          },
          opts: {
            delay: delayMs,
            removeOnComplete: true,
          },
        };
      }),
    );

    if (jobs.length > 0) {
      try {
        await this.whatsappQueue.addBulk(jobs);
      } catch {
        await this.prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'FAILED' },
        });
      }
    }

    return campaign;
  }

  createCampaignInMemory(data: {
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
  }): CampaignRecord {
    const record: CampaignRecord = {
      id: randomUUID(),
      name: data.name,
      message: data.message,
      status: data.scheduledAt ? 'SCHEDULED' : 'PROCESSING',
      createdAt: new Date().toISOString(),
      ...(data.scheduledAt ? { scheduledFor: data.scheduledAt } : {}),
      userId: data.userId,
      contactIds: data.contactIds,
      instanceName: data.instanceName,
      delay: data.delay,
    };

    const prev = CampaignsService.demoCampaignsByUser.get(data.userId) ?? [];
    CampaignsService.demoCampaignsByUser.set(data.userId, [record, ...prev]);
    return record;
  }

  async findAll(userId?: string) {
    try {
      if (userId) {
        return await this.prisma.campaign.findMany({
          where: { userId },
          include: { messages: true },
        });
      }
      return await this.prisma.campaign.findMany({
        include: { messages: true },
      });
    } catch {
      if (userId) return this.ensureDemoCampaigns(userId);
      const all = Array.from(
        CampaignsService.demoCampaignsByUser.values(),
      ).flat();
      if (all.length > 0) return all;
      return this.ensureDemoCampaigns('mock-user-id');
    }
  }

  async findOne(id: string) {
    try {
      return await this.prisma.campaign.findUnique({
        where: { id },
        include: {
          messages: true,
        },
      });
    } catch {
      for (const campaigns of CampaignsService.demoCampaignsByUser.values()) {
        const found = campaigns.find((c) => c.id === id);
        if (found) return found;
      }
      return null;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.message.deleteMany({ where: { campaignId: id } });
      return await this.prisma.campaign.delete({ where: { id } });
    } catch {
      for (const [userId, campaigns] of CampaignsService.demoCampaignsByUser) {
        const idx = campaigns.findIndex((c) => c.id === id);
        if (idx === -1) continue;
        const removed = campaigns[idx];
        CampaignsService.demoCampaignsByUser.set(
          userId,
          campaigns.filter((c) => c.id !== id),
        );
        return removed;
      }
      return { id, deleted: false };
    }
  }

  private ensureDemoCampaigns(userId: string): CampaignRecord[] {
    const existing = CampaignsService.demoCampaignsByUser.get(userId);
    if (existing && existing.length > 0) return existing;

    const now = new Date().toISOString();
    const demo: CampaignRecord[] = [
      {
        id: randomUUID(),
        name: 'Welcome Series',
        message: 'Olá! Bem-vindo ao Portal ComexBr.',
        status: 'PROCESSING',
        createdAt: now,
        userId,
        contactIds: [],
        instanceName: 'Evolution1',
        delay: 5000,
      },
      {
        id: randomUUID(),
        name: 'Black Friday Promo',
        message: 'Não perca nossas ofertas!',
        status: 'SCHEDULED',
        createdAt: now,
        scheduledFor: new Date(Date.now() + 86400000).toISOString(),
        userId,
        contactIds: [],
        instanceName: 'Evolution1',
        delay: 5000,
      },
    ];

    CampaignsService.demoCampaignsByUser.set(userId, demo);
    return demo;
  }
}

type CampaignRecord = {
  id: string;
  name: string;
  message: string;
  status: string;
  createdAt: string;
  scheduledFor?: string;
  stats?: { sent: number; delivered: number; read: number; failed: number };
  userId: string;
  contactIds: string[];
  instanceName: string;
  delay?: number;
};
