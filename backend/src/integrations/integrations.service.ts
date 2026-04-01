import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  IncomingWebhookEndpoint,
  OutgoingWebhookSubscription,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LeadScoringService } from '../lead-scoring/lead-scoring.service';
import { randomUUID } from 'crypto';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getPathValue(payload: unknown, path: string): unknown {
  const parts = path.split('.').filter((p) => p.length > 0);
  let cur: unknown = payload;
  for (const p of parts) {
    if (!isRecord(cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

type IncomingMapping = {
  eventType?: string;
  eventTypeField?: string;
  eventTypePrefix?: string;
  phoneField?: string;
  contactNameField?: string;
};

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadScoringService: LeadScoringService,
  ) {}

  private async logAudit(data: {
    userId: string;
    projectId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          projectId: data.projectId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          metadata: data.metadata
            ? (data.metadata as Prisma.InputJsonValue)
            : undefined,
        },
      });
    } catch {
      return;
    }
  }

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
    if (!project) throw new Error('Forbidden');
  }

  async createIncomingEndpoint(data: {
    userId: string;
    projectId?: string;
    name: string;
    provider?: string;
    mapping?: IncomingMapping;
  }): Promise<IncomingWebhookEndpoint> {
    await this.ensureUser(data.userId);
    if (data.projectId) {
      await this.ensureProjectAccess({
        userId: data.userId,
        projectId: data.projectId,
      });
    }
    const token = randomUUID().replace(/-/g, '');
    const created = await this.prisma.incomingWebhookEndpoint.create({
      data: {
        userId: data.userId,
        projectId: data.projectId,
        name: data.name,
        provider: data.provider ?? 'WEBHOOK',
        token,
        enabled: true,
        mapping: data.mapping
          ? (data.mapping as Prisma.InputJsonValue)
          : undefined,
      },
    });
    await this.logAudit({
      userId: data.userId,
      projectId: data.projectId,
      action: 'integration.incoming.create',
      entityType: 'IncomingWebhookEndpoint',
      entityId: created.id,
      metadata: { name: created.name, provider: created.provider },
    });
    return created;
  }

  async listIncomingEndpoints(params: { userId: string; projectId?: string }) {
    if (params.projectId) {
      await this.ensureProjectAccess({
        userId: params.userId,
        projectId: params.projectId,
      });
    }
    return await this.prisma.incomingWebhookEndpoint.findMany({
      where: {
        userId: params.userId,
        ...(params.projectId ? { projectId: params.projectId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteIncomingEndpoint(params: { id: string; userId: string }) {
    const found = await this.prisma.incomingWebhookEndpoint.findFirst({
      where: { id: params.id, userId: params.userId },
    });
    if (!found) return { id: params.id, deleted: false };
    await this.prisma.incomingWebhookEndpoint.delete({
      where: { id: params.id },
    });
    return { id: params.id, deleted: true };
  }

  async createOutgoingSubscription(data: {
    userId: string;
    projectId?: string;
    name: string;
    url: string;
    eventTypes: string[];
    secret?: string;
  }): Promise<OutgoingWebhookSubscription> {
    await this.ensureUser(data.userId);
    if (data.projectId) {
      await this.ensureProjectAccess({
        userId: data.userId,
        projectId: data.projectId,
      });
    }
    const created = await this.prisma.outgoingWebhookSubscription.create({
      data: {
        userId: data.userId,
        projectId: data.projectId,
        name: data.name,
        url: data.url,
        eventTypes: data.eventTypes,
        secret: data.secret,
        enabled: true,
      },
    });
    await this.logAudit({
      userId: data.userId,
      projectId: data.projectId,
      action: 'integration.outgoing.create',
      entityType: 'OutgoingWebhookSubscription',
      entityId: created.id,
      metadata: { name: created.name, url: created.url },
    });
    return created;
  }

  async listOutgoingSubscriptions(params: {
    userId: string;
    projectId?: string;
  }) {
    if (params.projectId) {
      await this.ensureProjectAccess({
        userId: params.userId,
        projectId: params.projectId,
      });
    }
    return await this.prisma.outgoingWebhookSubscription.findMany({
      where: {
        userId: params.userId,
        ...(params.projectId ? { projectId: params.projectId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteOutgoingSubscription(params: { id: string; userId: string }) {
    const found = await this.prisma.outgoingWebhookSubscription.findFirst({
      where: { id: params.id, userId: params.userId },
    });
    if (!found) return { id: params.id, deleted: false };
    await this.prisma.outgoingWebhookSubscription.delete({
      where: { id: params.id },
    });
    return { id: params.id, deleted: true };
  }

  private mapIncomingEventType(data: {
    provider: string;
    mapping?: IncomingMapping | null;
    payload: unknown;
  }) {
    const mapping = data.mapping ?? undefined;
    const provider = data.provider || 'WEBHOOK';

    if (mapping?.eventType) return mapping.eventType;

    let raw: unknown;
    if (mapping?.eventTypeField)
      raw = getPathValue(data.payload, mapping.eventTypeField);
    if (
      raw === undefined &&
      isRecord(data.payload) &&
      typeof data.payload.event === 'string'
    ) {
      raw = data.payload.event;
    }
    if (
      raw === undefined &&
      isRecord(data.payload) &&
      typeof data.payload.type === 'string'
    ) {
      raw = data.payload.type;
    }

    const rawStr = typeof raw === 'string' ? raw : '';
    const normalized = rawStr.trim();
    const prefix = mapping?.eventTypePrefix ?? '';
    const base = normalized
      ? normalized.toLowerCase().replace(/\s+/g, '_')
      : 'event';

    const providerLower = provider.toLowerCase();
    if (providerLower === 'hotmart') {
      if (base.includes('abandon')) return 'purchase.cart_abandoned';
      if (base.includes('approved') || base.includes('purchase_approved'))
        return 'purchase.approved';
      if (base.includes('refunded') || base.includes('refund'))
        return 'purchase.refunded';
    }

    return `${prefix}${providerLower}.${base}`;
  }

  private extractPhone(payload: unknown, mapping?: IncomingMapping | null) {
    const path = mapping?.phoneField;
    const raw = path ? getPathValue(payload, path) : undefined;
    const candidates = [
      raw,
      isRecord(payload) ? payload.phone : undefined,
      isRecord(payload) && isRecord(payload.buyer)
        ? payload.buyer.phone
        : undefined,
      isRecord(payload) && isRecord(payload.customer)
        ? payload.customer.phone
        : undefined,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return undefined;
  }

  async receiveIncomingWebhook(token: string, payload: unknown) {
    const endpoint = await this.prisma.incomingWebhookEndpoint.findFirst({
      where: { token, enabled: true },
    });
    if (!endpoint) return { received: false };

    const mapping =
      (endpoint.mapping as unknown as IncomingMapping | null) ?? null;
    const type = this.mapIncomingEventType({
      provider: endpoint.provider,
      mapping,
      payload,
    });
    const phone = this.extractPhone(payload, mapping);

    const metadata = isRecord(payload) ? payload : { payload };
    try {
      return await this.leadScoringService.ingestEvent({
        userId: endpoint.userId,
        projectId: endpoint.projectId ?? undefined,
        type,
        source: endpoint.provider,
        phone,
        metadata,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { received: false };
    }
  }
}
