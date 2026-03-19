import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
  ) {}

  async processIncomingMessage(
    phone: string,
    text: string,
    instanceName: string,
  ) {
    this.logger.log(
      `Processing message from ${phone}: ${text} on instance ${instanceName}`,
    );

    // 1. Find user by instance name
    const session = await this.prisma.whatsappSession.findFirst({
      where: { name: instanceName },
      select: { userId: true },
    });

    if (!session) {
      this.logger.warn(`No session found for instance: ${instanceName}`);
      return;
    }

    // 2. Find automations for this user only
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
          2000, // 2 seconds delay for natural feel
        );

        // Stop after first match? Depends on requirements. Assuming yes for now.
        break;
      }
    }
  }

  async create(data: { keyword: string; response: string; userId: string }) {
    return this.prisma.automation.create({ data });
  }

  async update(id: string, data: { keyword?: string; response?: string }) {
    return this.prisma.automation.update({
      where: { id },
      data,
    });
  }

  async findAll() {
    return this.prisma.automation.findMany();
  }

  async remove(id: string) {
    return this.prisma.automation.delete({ where: { id } });
  }
}
