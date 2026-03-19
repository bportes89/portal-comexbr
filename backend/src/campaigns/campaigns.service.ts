import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class CampaignsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('whatsapp-queue') private whatsappQueue: Queue,
  ) {}

  async createCampaign(data: {
    name: string;
    message: string;
    userId: string;
    contactIds: string[];
    instanceName: string;
    delay?: number;
  }) {
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

    await this.whatsappQueue.addBulk(jobs);

    return campaign;
  }

  findAll() {
    return this.prisma.campaign.findMany({
      include: {
        messages: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.campaign.findUnique({
      where: { id },
      include: {
        messages: true,
      },
    });
  }
}
