import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name);
  private static demoAutomationsByUser = new Map<string, AutomationRecord[]>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
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

  async processIncomingMessage(
    phone: string,
    text: string,
    instanceName: string,
  ) {
    if (phone.endsWith('@g.us')) return;
    this.logger.log(
      `Processing message from ${phone}: ${text} on instance ${instanceName}`,
    );

    try {
      const session = await this.prisma.whatsappSession.findFirst({
        where: { name: instanceName },
        select: { userId: true, projectId: true },
      });

      if (!session) {
        this.logger.warn(`No session found for instance: ${instanceName}`);
        return;
      }

      const contact = await this.prisma.contact.findFirst({
        where: {
          phone,
          userId: session.userId,
          ...(session.projectId ? { projectId: session.projectId } : {}),
        },
        select: { id: true, tags: true },
      });

      const lower = text.trim().toLowerCase();
      const optoutWords = ['stop', 'sair', 'cancelar', 'parar', 'unsubscribe'];
      if (contact && optoutWords.some((w) => lower.includes(w))) {
        const tags = new Set([...(contact.tags ?? [])]);
        tags.add('system:optout');
        await this.prisma.contact.update({
          where: { id: contact.id },
          data: { tags: Array.from(tags) },
        });
        return;
      }

      const automations = await this.prisma.automation.findMany({
        where: {
          userId: session.userId,
          keyword: { not: { startsWith: 'event:' } },
          OR: [{ projectId: session.projectId ?? null }, { projectId: null }],
        },
        orderBy: { createdAt: 'desc' },
      });

      for (const automation of automations) {
        if (text.toLowerCase().includes(automation.keyword.toLowerCase())) {
          this.logger.log(
            `Keyword matched: ${automation.keyword}. Sending response.`,
          );

          const parsed = this.parseAutomationResponse(automation.response);
          if (parsed.type === 'sequence') {
            let cumulativeDelay = 0;
            for (const step of parsed.steps) {
              cumulativeDelay += step.delayMs ?? 0;
              const msg = contact
                ? await this.prisma.message.create({
                    data: {
                      content: step.text,
                      status: 'PENDING',
                      contactId: contact.id,
                      instanceName,
                    },
                  })
                : null;
              await this.whatsappService.queueMessage(
                instanceName,
                phone,
                step.text,
                2000 + cumulativeDelay,
                msg?.id,
              );
            }
          } else if (parsed.type === 'media') {
            const msg = contact
              ? await this.prisma.message.create({
                  data: {
                    content: parsed.caption?.trim()
                      ? parsed.caption
                      : parsed.fileName,
                    status: 'PENDING',
                    contactId: contact.id,
                    instanceName,
                  },
                })
              : null;
            await this.whatsappService.queueMedia(
              instanceName,
              phone,
              {
                mediaType: parsed.mediaType,
                mimeType: parsed.mimeType,
                media: parsed.media,
                fileName: parsed.fileName,
                caption: parsed.caption,
              },
              2000 + (parsed.delayMs ?? 0),
              msg?.id,
            );
          } else {
            const msg = contact
              ? await this.prisma.message.create({
                  data: {
                    content: parsed.text,
                    status: 'PENDING',
                    contactId: contact.id,
                    instanceName,
                  },
                })
              : null;
            await this.whatsappService.queueMessage(
              instanceName,
              phone,
              parsed.text,
              2000,
              msg?.id,
            );
          }

          break;
        }
      }
    } catch (error: unknown) {
      this.logger.error(error);
    }
  }

  private matchesEventTrigger(keyword: string, eventType: string) {
    const trimmed = keyword.trim();
    if (!trimmed.toLowerCase().startsWith('event:')) return false;
    const pattern = trimmed.slice('event:'.length).trim().toLowerCase();
    const target = eventType.trim().toLowerCase();
    if (!pattern) return false;
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return target.startsWith(prefix);
    }
    return target === pattern;
  }

  async processIncomingEvent(data: {
    userId: string;
    projectId?: string;
    phone: string;
    contactId?: string;
    eventType: string;
    metadata?: Record<string, unknown>;
  }) {
    const phone = data.phone.trim();
    if (!phone) return;

    const session =
      (data.projectId
        ? await this.prisma.whatsappSession.findFirst({
            where: {
              userId: data.userId,
              projectId: data.projectId,
              status: 'CONNECTED',
            },
            orderBy: { updatedAt: 'desc' },
            select: { name: true },
          })
        : null) ??
      (await this.prisma.whatsappSession.findFirst({
        where: { userId: data.userId, status: 'CONNECTED' },
        orderBy: { updatedAt: 'desc' },
        select: { name: true },
      }));

    const instanceName = session?.name;
    if (!instanceName) return;

    const contact = data.contactId
      ? await this.prisma.contact.findFirst({
          where: {
            id: data.contactId,
            userId: data.userId,
            ...(data.projectId ? { projectId: data.projectId } : {}),
          },
          select: { id: true },
        })
      : await this.prisma.contact.findFirst({
          where: {
            phone,
            userId: data.userId,
            ...(data.projectId ? { projectId: data.projectId } : {}),
          },
          select: { id: true },
        });

    if (!contact) return;

    const automations = await this.prisma.automation.findMany({
      where: {
        userId: data.userId,
        keyword: { startsWith: 'event:' },
        OR: [{ projectId: data.projectId ?? null }, { projectId: null }],
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const automation of automations) {
      if (!this.matchesEventTrigger(automation.keyword, data.eventType))
        continue;

      const parsed = this.parseAutomationResponse(automation.response);
      if (parsed.type === 'sequence') {
        let cumulativeDelay = 0;
        for (const step of parsed.steps) {
          const stepDelay = typeof step.delayMs === 'number' ? step.delayMs : 0;
          cumulativeDelay += stepDelay;

          const msg = await this.prisma.message.create({
            data: {
              content: step.text,
              status: 'PENDING',
              contactId: contact.id,
              instanceName,
            },
          });

          await this.whatsappService.queueMessage(
            instanceName,
            phone,
            step.text,
            2000 + cumulativeDelay,
            msg.id,
          );
        }
      } else if (parsed.type === 'media') {
        const msg = await this.prisma.message.create({
          data: {
            content: parsed.caption?.trim() ? parsed.caption : parsed.fileName,
            status: 'PENDING',
            contactId: contact.id,
            instanceName,
          },
        });

        await this.whatsappService.queueMedia(
          instanceName,
          phone,
          {
            mediaType: parsed.mediaType,
            mimeType: parsed.mimeType,
            media: parsed.media,
            fileName: parsed.fileName,
            caption: parsed.caption,
          },
          2000 + (parsed.delayMs ?? 0),
          msg.id,
        );
      } else {
        const msg = await this.prisma.message.create({
          data: {
            content: parsed.text,
            status: 'PENDING',
            contactId: contact.id,
            instanceName,
          },
        });

        await this.whatsappService.queueMessage(
          instanceName,
          phone,
          parsed.text,
          2000,
          msg.id,
        );
      }

      break;
    }
  }

  private parseAutomationResponse(response: string):
    | { type: 'text'; text: string }
    | { type: 'sequence'; steps: Array<{ text: string; delayMs?: number }> }
    | {
        type: 'media';
        mediaType: string;
        mimeType: string;
        media: string;
        fileName: string;
        caption?: string;
        delayMs?: number;
      } {
    const trimmed = response.trim();
    if (!trimmed.startsWith('{')) return { type: 'text', text: response };

    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object')
        return { type: 'text', text: response };

      const record = parsed as Record<string, unknown>;
      if (record.type === 'sequence' && Array.isArray(record.steps)) {
        const steps: Array<{ text: string; delayMs?: number }> = record.steps
          .map((s) => {
            if (!s || typeof s !== 'object') return null;
            const step = s as Record<string, unknown>;
            const text = typeof step.text === 'string' ? step.text : '';
            if (!text.trim()) return null;
            const delayMs =
              typeof step.delayMs === 'number' ? step.delayMs : undefined;
            return delayMs === undefined ? { text } : { text, delayMs };
          })
          .filter((s): s is { text: string; delayMs?: number } => !!s);
        if (steps.length > 0) return { type: 'sequence', steps };
      }

      if (record.type === 'media') {
        const mediaType =
          typeof record.mediaType === 'string' ? record.mediaType : '';
        const mimeType =
          typeof record.mimeType === 'string' ? record.mimeType : '';
        const media = typeof record.media === 'string' ? record.media : '';
        const fileName =
          typeof record.fileName === 'string' ? record.fileName : '';
        const caption =
          typeof record.caption === 'string' ? record.caption : undefined;
        const delayMs =
          typeof record.delayMs === 'number' ? record.delayMs : undefined;
        if (mediaType && mimeType && media && fileName) {
          return {
            type: 'media',
            mediaType,
            mimeType,
            media,
            fileName,
            caption,
            delayMs,
          };
        }
      }
    } catch {
      return { type: 'text', text: response };
    }

    return { type: 'text', text: response };
  }

  async createForUser(data: {
    keyword: string;
    response: string;
    userId: string;
    projectId?: string;
  }) {
    try {
      await this.ensureUser(data.userId);
      return await this.prisma.automation.create({ data });
    } catch {
      return this.createInMemory(data);
    }
  }

  async applyTemplate(data: {
    templateKey: string;
    userId: string;
    projectId?: string;
  }) {
    await this.ensureUser(data.userId);

    if (data.templateKey === 'cart_abandoned') {
      const keyword = 'event:purchase.cart_abandoned';
      const response = JSON.stringify({
        type: 'sequence',
        steps: [
          {
            text: 'Vi que você quase finalizou sua compra. Posso te ajudar em algo?',
            delayMs: 0,
          },
          {
            text: 'Só passando pra lembrar: seu carrinho ainda está disponível. Quer o link de pagamento?',
            delayMs: 2 * 60 * 60 * 1000,
          },
          {
            text: 'Última chamada: consigo te dar suporte agora pra finalizar. Quer que eu te envie o link?',
            delayMs: 24 * 60 * 60 * 1000,
          },
        ],
      });

      const existing = await this.prisma.automation.findFirst({
        where: {
          userId: data.userId,
          projectId: data.projectId ?? null,
          keyword,
        },
      });
      if (existing) return existing;

      return await this.prisma.automation.create({
        data: {
          userId: data.userId,
          projectId: data.projectId,
          keyword,
          response,
        },
      });
    }

    return { created: false };
  }

  async update(id: string, data: { keyword?: string; response?: string }) {
    try {
      return await this.prisma.automation.update({
        where: { id },
        data,
      });
    } catch {
      for (const [
        userId,
        automations,
      ] of AutomationsService.demoAutomationsByUser.entries()) {
        const idx = automations.findIndex((a) => a.id === id);
        if (idx === -1) continue;

        const updated: AutomationRecord = {
          ...automations[idx],
          keyword: data.keyword ?? automations[idx].keyword,
          response: data.response ?? automations[idx].response,
          updatedAt: new Date(),
        };
        const next = [...automations];
        next[idx] = updated;
        AutomationsService.demoAutomationsByUser.set(userId, next);
        return updated;
      }
      throw new Error('Automation not found');
    }
  }

  async findAll(userId?: string) {
    try {
      if (userId)
        return await this.prisma.automation.findMany({ where: { userId } });
      return await this.prisma.automation.findMany();
    } catch {
      if (userId)
        return AutomationsService.demoAutomationsByUser.get(userId) ?? [];
      return Array.from(
        AutomationsService.demoAutomationsByUser.values(),
      ).flat();
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.automation.delete({ where: { id } });
    } catch {
      for (const [
        userId,
        automations,
      ] of AutomationsService.demoAutomationsByUser.entries()) {
        const idx = automations.findIndex((a) => a.id === id);
        if (idx === -1) continue;
        const removed = automations[idx];
        AutomationsService.demoAutomationsByUser.set(
          userId,
          automations.filter((a) => a.id !== id),
        );
        return removed;
      }
      throw new Error('Automation not found');
    }
  }

  private createInMemory(data: {
    keyword: string;
    response: string;
    userId: string;
    projectId?: string;
  }): AutomationRecord {
    const rule: AutomationRecord = {
      id: randomUUID(),
      keyword: data.keyword,
      response: data.response,
      userId: data.userId,
      projectId: data.projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prev =
      AutomationsService.demoAutomationsByUser.get(data.userId) ?? [];
    AutomationsService.demoAutomationsByUser.set(data.userId, [rule, ...prev]);
    return rule;
  }
}

type AutomationRecord = {
  id: string;
  keyword: string;
  response: string;
  userId: string;
  projectId?: string;
  createdAt: Date;
  updatedAt: Date;
};
