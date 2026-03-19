import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WhatsappService } from './whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';

interface SendMessageJobData {
  instanceName: string;
  number: string;
  text: string;
  messageId?: string;
}

@Processor('whatsapp-queue')
export class WhatsappProcessor extends WorkerHost {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(
    job: Job<SendMessageJobData, unknown, string>,
  ): Promise<unknown> {
    switch (job.name) {
      case 'sendMessage': {
        const { instanceName, number, text, messageId } = job.data;
        try {
          const result = await this.whatsappService.sendMessage(
            instanceName,
            number,
            text,
          );

          if (messageId) {
            await this.prisma.message.update({
              where: { id: messageId },
              data: { status: 'SENT', sentAt: new Date() },
            });
          }

          return result;
        } catch (error) {
          if (messageId) {
            await this.prisma.message.update({
              where: { id: messageId },
              data: { status: 'FAILED' },
            });
          }
          throw error;
        }
      }
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }
}
