import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { normalizeWhatsAppNumber } from '../whatsapp/phone.util';
import { isMessageQueueEnabled } from '../queue/message-queue.state';

type QueueJob = {
  name: string;
  data: {
    instanceName: string;
    number: string;
    text: string;
    messageId: string;
  };
  opts: {
    delay: number;
    removeOnComplete: boolean;
  };
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

@Injectable()
export class CampaignsService {
  private static demoCampaignsByUser = new Map<string, CampaignRecord[]>();
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('whatsapp-queue') private whatsappQueue: Queue,
    private whatsappService: WhatsappService,
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

  private getTimezoneOffsetMin(explicit?: number, fallback = new Date()) {
    return typeof explicit === 'number' && Number.isFinite(explicit)
      ? Math.floor(explicit)
      : fallback.getTimezoneOffset();
  }

  private getWallClockMinutes(date: Date, timezoneOffsetMin?: number) {
    const offset = this.getTimezoneOffsetMin(timezoneOffsetMin, date);
    const wall = new Date(date.getTime() - offset * 60_000);
    return wall.getUTCHours() * 60 + wall.getUTCMinutes();
  }

  private withWallClockMinutes(
    base: Date,
    minutes: number,
    timezoneOffsetMin?: number,
    dayDelta = 0,
  ) {
    const offset = this.getTimezoneOffsetMin(timezoneOffsetMin, base);
    const wall = new Date(base.getTime() - offset * 60_000);
    const nextLocal = Date.UTC(
      wall.getUTCFullYear(),
      wall.getUTCMonth(),
      wall.getUTCDate() + dayDelta,
      Math.floor(minutes / 60),
      minutes % 60,
      0,
      0,
    );
    return new Date(nextLocal + offset * 60_000);
  }

  private computeNextAllowedStart(params: {
    base: Date;
    startMin?: number;
    endMin?: number;
    timezoneOffsetMin?: number;
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
    const currentMin = this.getWallClockMinutes(base, params.timezoneOffsetMin);

    const isAllowed =
      startMin <= endMin
        ? currentMin >= startMin && currentMin <= endMin
        : currentMin >= startMin || currentMin <= endMin;
    if (isAllowed) return base;

    if (startMin <= endMin) {
      if (currentMin < startMin) {
        return this.withWallClockMinutes(
          base,
          startMin,
          params.timezoneOffsetMin,
        );
      }
      return this.withWallClockMinutes(
        base,
        startMin,
        params.timezoneOffsetMin,
        1,
      );
    }

    const next = this.withWallClockMinutes(
      base,
      startMin,
      params.timezoneOffsetMin,
    );
    if (currentMin > endMin && currentMin < startMin) {
      return next;
    }
    return next;
  }

  private async isQueueAvailable() {
    if (!isMessageQueueEnabled()) return false;
    try {
      const client = await this.whatsappQueue.client;
      const pong = await client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  private async tryEnqueueJobs(jobs: QueueJob[]) {
    if (jobs.length === 0) return true;
    if (!(await this.isQueueAvailable())) return false;
    try {
      await this.whatsappQueue.addBulk(jobs);
      return true;
    } catch (error) {
      this.logger.warn(`Fila indisponível, enviando diretamente: ${error}`);
      return false;
    }
  }

  private async refreshCampaignStatus(campaignId: string, instanceName: string) {
    await this.prisma.campaign.updateMany({
      where: { id: campaignId, status: { in: ['SCHEDULED', 'PENDING'] } },
      data: { status: 'PROCESSING', instanceName },
    });

    const pending = await this.prisma.message.count({
      where: { campaignId, status: 'PENDING' },
    });
    if (pending > 0) return;

    const failed = await this.prisma.message.count({
      where: { campaignId, status: 'FAILED' },
    });
    const sent = await this.prisma.message.count({
      where: {
        campaignId,
        status: { in: ['SENT', 'DELIVERED', 'READ'] },
      },
    });
    await this.prisma.campaign.updateMany({
      where: { id: campaignId, status: { not: 'FAILED' } },
      data: { status: sent > 0 ? 'COMPLETED' : failed > 0 ? 'FAILED' : 'COMPLETED' },
    });
  }

  private async failPendingCampaignMessages(
    campaignId: string,
    instanceName: string,
    reason: string,
  ) {
    await this.prisma.message.updateMany({
      where: { campaignId, status: 'PENDING' },
      data: { status: 'FAILED', instanceName },
    });
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED', instanceName },
    });
    this.logger.error(`Campanha ${campaignId} falhou: ${reason}`);
  }

  private normalizeContactPhone(phone: string) {
    try {
      return normalizeWhatsAppNumber(phone);
    } catch (error) {
      throw new Error(`Telefone inválido (${phone}): ${getErrorMessage(error)}`);
    }
  }

  private async dispatchJobsDirectly(
    jobs: QueueJob[],
    campaignId: string,
    instanceName: string,
  ) {
    if (jobs.length === 0) return;

    try {
      await this.whatsappService.ensureInstanceConnected(instanceName);
    } catch (error) {
      await this.failPendingCampaignMessages(
        campaignId,
        instanceName,
        getErrorMessage(error),
      );
      return;
    }

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'PROCESSING', instanceName },
    });

    for (const job of jobs) {
      const run = async () => {
        const { instanceName: inst, number, text, messageId } = job.data;
        try {
          await this.whatsappService.sendMessage(inst, number, text);
          await this.prisma.message.update({
            where: { id: messageId },
            data: { status: 'SENT', sentAt: new Date(), instanceName: inst },
          });
        } catch (error) {
          this.logger.error(`Falha ao enviar mensagem ${messageId}: ${error}`);
          await this.prisma.message.update({
            where: { id: messageId },
            data: { status: 'FAILED', instanceName: inst },
          });
        }
        await this.refreshCampaignStatus(campaignId, inst);
      };

      if (job.opts.delay > 0) {
        setTimeout(() => void run(), job.opts.delay);
      } else {
        await run();
      }
    }
  }

  async processDueScheduledCampaigns() {
    const now = new Date();
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
      },
      include: {
        messages: {
          where: { status: 'PENDING' },
          include: { contact: { select: { phone: true } } },
        },
      },
    });

    for (const campaign of campaigns) {
      if (campaign.messages.length === 0) {
        await this.refreshCampaignStatus(
          campaign.id,
          campaign.instanceName ?? '',
        );
        continue;
      }

      const instance = campaign.instanceName ?? '';
      try {
        await this.whatsappService.ensureInstanceConnected(instance);
      } catch (error) {
        await this.failPendingCampaignMessages(
          campaign.id,
          instance,
          getErrorMessage(error),
        );
        continue;
      }

      const perMessageDelayMs = 5000;
      const jobs: QueueJob[] = campaign.messages.map((message, index) => ({
        name: 'sendMessage',
        data: {
          instanceName: message.instanceName ?? campaign.instanceName ?? '',
          number: this.normalizeContactPhone(message.contact.phone),
          text: message.content,
          messageId: message.id,
        },
        opts: {
          delay: index * perMessageDelayMs,
          removeOnComplete: true,
        },
      }));

      const queued = await this.tryEnqueueJobs(jobs);
      if (!queued) {
        await this.dispatchJobsDirectly(
          jobs,
          campaign.id,
          campaign.instanceName ?? '',
        );
      } else {
        await this.prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'PROCESSING' },
        });
      }
    }
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
    timezoneOffsetMin?: number;
  }) {
    await this.ensureUser(data.userId);
    if (data.projectId) {
      await this.ensureProjectAccess({
        userId: data.userId,
        projectId: data.projectId,
      });
    }

    const now = new Date();
    const hasExplicitSchedule = !!data.scheduledAt;
    const baseRequested = data.scheduledAt ?? now;
    const baseAllowed = hasExplicitSchedule
      ? new Date(baseRequested)
      : this.computeNextAllowedStart({
          base: baseRequested,
          startMin: data.sendWindowStartMin,
          endMin: data.sendWindowEndMin,
          timezoneOffsetMin: data.timezoneOffsetMin,
        });
    const base = baseAllowed.getTime() < now.getTime() ? now : baseAllowed;
    const startDelayMs = Math.max(0, base.getTime() - now.getTime());

    if (startDelayMs === 0) {
      await this.whatsappService.ensureInstanceConnected(data.instanceName);
    }

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
      const adjusted = hasExplicitSchedule
        ? candidate
        : this.computeNextAllowedStart({
            base: candidate,
            startMin: data.sendWindowStartMin,
            endMin: data.sendWindowEndMin,
            timezoneOffsetMin: data.timezoneOffsetMin,
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
            number: this.normalizeContactPhone(contact.phone),
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
      const queued = await this.tryEnqueueJobs(jobs);
      if (!queued) {
        await this.dispatchJobsDirectly(jobs, campaign.id, data.instanceName);
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
