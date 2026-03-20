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

  async createCampaign(data: {
    name: string;
    message: string;
    userId: string;
    contactIds: string[];
    instanceName: string;
    delay?: number;
  }) {
    await this.ensureUser(data.userId);

    // 1. Create Campaign in DB
    const campaign = await this.prisma.campaign.create({
      data: {
        name: data.name,
        message: data.message,
        userId: data.userId,
        status: 'PROCESSING',
      },
    });

    // 2. Create Message records and add jobs to Queue for each contact
    // Fetch contacts to get their phone numbers
    const contacts = await this.prisma.contact.findMany({
      where: {
        id: { in: data.contactIds },
      },
    });

    const jobs = await Promise.all(
      contacts.map(async (contact, index) => {
        // Create Message record
        const message = await this.prisma.message.create({
          data: {
            content: data.message,
            status: 'PENDING',
            campaignId: campaign.id,
            contactId: contact.id,
          },
        });

        return {
          name: 'sendMessage',
          data: {
            instanceName: data.instanceName,
            number: contact.phone,
            text: data.message,
            messageId: message.id, // Pass messageId to the job
          },
          opts: {
            delay: index * (data.delay || 5000), // Staggered delay: 0s, 5s, 10s...
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
    contactIds: string[];
    instanceName: string;
    delay?: number;
  }): CampaignRecord {
    const record: CampaignRecord = {
      id: randomUUID(),
      name: data.name,
      message: data.message,
      status: 'PROCESSING',
      createdAt: new Date().toISOString(),
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
