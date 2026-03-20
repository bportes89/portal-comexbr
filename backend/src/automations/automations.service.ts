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
    this.logger.log(
      `Processing message from ${phone}: ${text} on instance ${instanceName}`,
    );

    try {
      const session = await this.prisma.whatsappSession.findFirst({
        where: { name: instanceName },
        select: { userId: true },
      });

      if (!session) {
        this.logger.warn(`No session found for instance: ${instanceName}`);
        return;
      }

      const automations = await this.prisma.automation.findMany({
        where: { userId: session.userId },
      });

      for (const automation of automations) {
        if (text.toLowerCase().includes(automation.keyword.toLowerCase())) {
          this.logger.log(
            `Keyword matched: ${automation.keyword}. Sending response.`,
          );

          await this.whatsappService.queueMessage(
            instanceName,
            phone,
            automation.response,
            2000,
          );

          break;
        }
      }
    } catch (error: unknown) {
      this.logger.error(error);
    }
  }

  async createForUser(data: {
    keyword: string;
    response: string;
    userId: string;
  }) {
    try {
      await this.ensureUser(data.userId);
      return await this.prisma.automation.create({ data });
    } catch {
      return this.createInMemory(data);
    }
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
  }): AutomationRecord {
    const rule: AutomationRecord = {
      id: randomUUID(),
      keyword: data.keyword,
      response: data.response,
      userId: data.userId,
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
  createdAt: Date;
  updatedAt: Date;
};
