import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationsService } from '../automations/automations.service';
import { lastValueFrom } from 'rxjs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

type CreateRuleInput = {
  userId: string;
  projectId?: string;
  name?: string;
  eventType: string;
  points: number;
  conditions?: Record<string, unknown>;
};

type IngestEventInput = {
  userId: string;
  projectId?: string;
  type: string;
  source?: string;
  contactId?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class LeadScoringService {
  private readonly logger = new Logger(LeadScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly automationsService: AutomationsService,
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

  async createRule(input: CreateRuleInput) {
    await this.ensureUser(input.userId);
    return await this.prisma.leadScoreRule.create({
      data: {
        userId: input.userId,
        projectId: input.projectId,
        name: input.name,
        eventType: input.eventType,
        points: input.points,
        conditions: input.conditions
          ? (input.conditions as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  async listRules(params: { userId?: string; projectId?: string }) {
    const where: Record<string, unknown> = {};
    if (params.userId) where.userId = params.userId;
    if (params.projectId) where.projectId = params.projectId;
    return await this.prisma.leadScoreRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteRule(id: string) {
    return await this.prisma.leadScoreRule.delete({ where: { id } });
  }

  async ingestEvent(input: IngestEventInput) {
    await this.ensureUser(input.userId);

    const contact = await this.resolveContact({
      userId: input.userId,
      contactId: input.contactId,
      phone: input.phone,
      projectId: input.projectId,
      metadata: input.metadata,
    });

    const storedEvent = await this.prisma.event.create({
      data: {
        userId: input.userId,
        projectId: input.projectId,
        type: input.type,
        source: input.source ?? 'webhook',
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : undefined,
        contactId: contact?.id,
      },
    });

    const phone = contact?.phone ?? input.phone;
    if (phone) {
      try {
        await this.automationsService.processIncomingEvent({
          userId: input.userId,
          projectId: input.projectId,
          phone,
          contactId: contact?.id,
          eventType: input.type,
          metadata: input.metadata,
        });
      } catch (error: unknown) {
        this.logger.error(error);
      }
    }

    try {
      await this.dispatchOutgoingWebhooks({
        userId: input.userId,
        projectId: input.projectId,
        event: storedEvent,
        contact,
        payload: input.metadata ?? {},
      });
    } catch (error: unknown) {
      this.logger.error(error);
    }

    if (!contact) return { event: storedEvent, scored: false, delta: 0 };

    const rules = await this.prisma.leadScoreRule.findMany({
      where: {
        userId: input.userId,
        eventType: input.type,
        OR: [{ projectId: input.projectId ?? null }, { projectId: null }],
      },
      orderBy: { createdAt: 'desc' },
    });

    let delta = 0;
    for (const rule of rules) {
      const ok = this.matches(rule.conditions as unknown, {
        metadata: input.metadata ?? {},
        contact,
      });
      if (!ok) continue;
      delta += rule.points;
    }

    if (delta !== 0) {
      await this.prisma.contact.update({
        where: { id: contact.id },
        data: {
          score: {
            increment: delta,
          },
        },
      });
    }

    return { event: storedEvent, scored: true, delta };
  }

  private async dispatchOutgoingWebhooks(data: {
    userId: string;
    projectId?: string;
    event: { id: string; type: string; source: string; createdAt: Date };
    contact: { id: string; name: string; phone: string } | null;
    payload: Record<string, unknown>;
  }) {
    const subscriptions =
      await this.prisma.outgoingWebhookSubscription.findMany({
        where: {
          userId: data.userId,
          enabled: true,
          eventTypes: { has: data.event.type },
          OR: [{ projectId: data.projectId ?? null }, { projectId: null }],
        },
        orderBy: { createdAt: 'desc' },
      });

    if (subscriptions.length === 0) return;

    const body = {
      event: data.event,
      contact: data.contact,
      payload: data.payload,
    };

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await lastValueFrom(
            this.httpService.post(sub.url, body, {
              headers: {
                'content-type': 'application/json',
                ...(sub.secret ? { 'x-hook-secret': sub.secret } : {}),
              },
            }),
          );
        } catch (error: unknown) {
          const msg =
            isRecord(error) && typeof error.message === 'string'
              ? error.message
              : String(error);
          this.logger.error(`Outgoing webhook failed: ${sub.url} (${msg})`);
        }
      }),
    );
  }

  async listEvents(params: {
    userId?: string;
    projectId?: string;
    contactId?: string;
    type?: string;
    take?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (params.userId) where.userId = params.userId;
    if (params.projectId) where.projectId = params.projectId;
    if (params.contactId) where.contactId = params.contactId;
    if (params.type) where.type = params.type;
    return await this.prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(params.take ?? 50, 1), 200),
    });
  }

  private matches(
    conditions: unknown,
    ctx: {
      metadata: Record<string, unknown>;
      contact: { tags: string[]; score: number };
    },
  ) {
    if (!conditions || typeof conditions !== 'object') return true;
    const record = conditions as Record<string, unknown>;

    const urlContains =
      typeof record.urlContains === 'string' ? record.urlContains : '';
    if (urlContains) {
      const url = typeof ctx.metadata.url === 'string' ? ctx.metadata.url : '';
      if (!url.toLowerCase().includes(urlContains.toLowerCase())) return false;
    }

    const textContains =
      typeof record.textContains === 'string' ? record.textContains : '';
    if (textContains) {
      const text =
        typeof ctx.metadata.text === 'string' ? ctx.metadata.text : '';
      if (!text.toLowerCase().includes(textContains.toLowerCase()))
        return false;
    }

    const tagIn = typeof record.tagIn === 'string' ? record.tagIn : '';
    if (tagIn) {
      if (!ctx.contact.tags?.includes(tagIn)) return false;
    }

    const minScore =
      typeof record.minScore === 'number' ? record.minScore : undefined;
    if (minScore !== undefined) {
      if ((ctx.contact.score ?? 0) < minScore) return false;
    }

    return true;
  }

  private extractContactName(metadata: Record<string, unknown> | undefined) {
    if (!metadata) return undefined;
    const direct =
      typeof metadata.name === 'string' ? metadata.name.trim() : '';
    if (direct) return direct;

    const buyer =
      isRecord(metadata.buyer) && typeof metadata.buyer.name === 'string'
        ? metadata.buyer.name.trim()
        : '';
    if (buyer) return buyer;

    const customer =
      isRecord(metadata.customer) && typeof metadata.customer.name === 'string'
        ? metadata.customer.name.trim()
        : '';
    if (customer) return customer;

    return undefined;
  }

  private async resolveContact(data: {
    userId: string;
    projectId?: string;
    contactId?: string;
    phone?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (data.contactId) {
      return await this.prisma.contact.findFirst({
        where: {
          id: data.contactId,
          userId: data.userId,
          ...(data.projectId ? { projectId: data.projectId } : {}),
        },
      });
    }

    if (data.phone) {
      const phone = data.phone.trim();
      if (!phone) return null;

      const existing = await this.prisma.contact.findFirst({
        where: {
          phone,
          userId: data.userId,
          ...(data.projectId ? { projectId: data.projectId } : {}),
        },
      });
      if (existing) return existing;

      const name = this.extractContactName(data.metadata) ?? phone;
      return await this.prisma.contact.create({
        data: {
          name,
          phone,
          tags: [],
          userId: data.userId,
          projectId: data.projectId,
        },
      });
    }

    return null;
  }
}
