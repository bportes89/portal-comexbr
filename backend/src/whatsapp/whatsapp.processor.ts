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

interface SendMediaJobData {
  instanceName: string;
  number: string;
  payload: {
    mediaType: string;
    mimeType: string;
    media: string;
    fileName: string;
    caption?: string;
  };
  messageId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractProviderMessageId(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;

  const data = isRecord(payload.data) ? payload.data : payload;
  if (!isRecord(data)) return undefined;

  const key = isRecord(data.key) ? data.key : undefined;
  const idFromKey = key && typeof key.id === 'string' ? key.id : undefined;
  if (idFromKey) return idFromKey;

  const messageId =
    typeof data.messageId === 'string'
      ? data.messageId
      : typeof data.id === 'string'
        ? data.id
        : undefined;
  if (messageId) return messageId;

  const nestedKey =
    isRecord(data.message) && isRecord(data.message.key)
      ? data.message.key
      : undefined;
  const idFromNestedKey =
    nestedKey && typeof nestedKey.id === 'string' ? nestedKey.id : undefined;
  return idFromNestedKey;
}

function getCurrentMonthStart() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getMonthlyMessageLimit() {
  const raw = process.env.MONTHLY_MESSAGE_LIMIT;
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function updateCampaignAfterMessage(params: {
  prisma: PrismaService;
  messageId: string;
  instanceName: string;
}) {
  const message = await params.prisma.message.findUnique({
    where: { id: params.messageId },
    select: { campaignId: true },
  });
  const campaignId = message?.campaignId;
  if (!campaignId) return;

  await params.prisma.campaign.updateMany({
    where: { id: campaignId, status: { in: ['SCHEDULED', 'PENDING'] } },
    data: { status: 'PROCESSING', instanceName: params.instanceName },
  });

  const pending = await params.prisma.message.count({
    where: { campaignId, status: 'PENDING' },
  });
  if (pending > 0) return;

  const failed = await params.prisma.message.count({
    where: { campaignId, status: 'FAILED' },
  });
  await params.prisma.campaign.updateMany({
    where: { id: campaignId, status: { not: 'FAILED' } },
    data: { status: failed > 0 ? 'FAILED' : 'COMPLETED' },
  });
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
    job: Job<SendMessageJobData | SendMediaJobData, unknown, string>,
  ): Promise<unknown> {
    switch (job.name) {
      case 'sendMessage': {
        const data = job.data as SendMessageJobData;
        const { instanceName, number, text, messageId } = data;
        try {
          const limit = getMonthlyMessageLimit();
          if (limit > 0) {
            const session = await this.prisma.whatsappSession.findFirst({
              where: { name: instanceName },
              select: { userId: true, projectId: true },
            });

            if (session) {
              const used = await this.prisma.message.count({
                where: {
                  status: { not: 'FAILED' },
                  createdAt: { gte: getCurrentMonthStart() },
                  contact: {
                    userId: session.userId,
                    ...(session.projectId
                      ? { projectId: session.projectId }
                      : {}),
                  },
                },
              });

              if (used >= limit) {
                if (messageId) {
                  await this.prisma.message.update({
                    where: { id: messageId },
                    data: { status: 'FAILED', instanceName },
                  });
                  await updateCampaignAfterMessage({
                    prisma: this.prisma,
                    messageId,
                    instanceName,
                  });
                }
                return { blocked: true, reason: 'monthly_quota' };
              }
            }
          }

          const result = await this.whatsappService.sendMessage(
            instanceName,
            number,
            text,
          );

          if (messageId) {
            const providerMessageId = extractProviderMessageId(result);
            await this.prisma.message.update({
              where: { id: messageId },
              data: {
                status: 'SENT',
                sentAt: new Date(),
                instanceName,
                ...(providerMessageId ? { providerMessageId } : {}),
              },
            });
            await updateCampaignAfterMessage({
              prisma: this.prisma,
              messageId,
              instanceName,
            });
          }

          return result;
        } catch (error) {
          if (messageId) {
            await this.prisma.message.update({
              where: { id: messageId },
              data: { status: 'FAILED' },
            });
            await updateCampaignAfterMessage({
              prisma: this.prisma,
              messageId,
              instanceName,
            });
          }
          throw error;
        }
      }
      case 'sendMedia': {
        const data = job.data as SendMediaJobData;
        const { instanceName, number, payload, messageId } = data;
        try {
          const limit = getMonthlyMessageLimit();
          if (limit > 0) {
            const session = await this.prisma.whatsappSession.findFirst({
              where: { name: instanceName },
              select: { userId: true, projectId: true },
            });

            if (session) {
              const used = await this.prisma.message.count({
                where: {
                  status: { not: 'FAILED' },
                  createdAt: { gte: getCurrentMonthStart() },
                  contact: {
                    userId: session.userId,
                    ...(session.projectId
                      ? { projectId: session.projectId }
                      : {}),
                  },
                },
              });

              if (used >= limit) {
                if (messageId) {
                  await this.prisma.message.update({
                    where: { id: messageId },
                    data: { status: 'FAILED', instanceName },
                  });
                  await updateCampaignAfterMessage({
                    prisma: this.prisma,
                    messageId,
                    instanceName,
                  });
                }
                return { blocked: true, reason: 'monthly_quota' };
              }
            }
          }

          const result = await this.whatsappService.sendMedia(
            instanceName,
            number,
            payload,
          );

          if (messageId) {
            const providerMessageId = extractProviderMessageId(result);
            await this.prisma.message.update({
              where: { id: messageId },
              data: {
                status: 'SENT',
                sentAt: new Date(),
                instanceName,
                ...(providerMessageId ? { providerMessageId } : {}),
              },
            });
            await updateCampaignAfterMessage({
              prisma: this.prisma,
              messageId,
              instanceName,
            });
          }

          return result;
        } catch (error) {
          if (messageId) {
            await this.prisma.message.update({
              where: { id: messageId },
              data: { status: 'FAILED' },
            });
            await updateCampaignAfterMessage({
              prisma: this.prisma,
              messageId,
              instanceName,
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
