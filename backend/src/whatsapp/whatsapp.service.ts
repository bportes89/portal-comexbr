import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { lastValueFrom } from 'rxjs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

interface SendMessageJobData {
  instanceName: string;
  number: string;
  text: string;
  messageId?: string;
}

type SendMediaPayload = {
  mediaType: string;
  mimeType: string;
  media: string;
  fileName: string;
  caption?: string;
};

interface SendMediaJobData {
  instanceName: string;
  number: string;
  payload: SendMediaPayload;
  messageId?: string;
}

type EvolutionGroup = {
  id: string;
  subject?: string;
  desc?: string | null;
  size?: number;
  creation?: number;
};

type EvolutionInviteCode = {
  inviteUrl?: string;
  inviteCode?: string;
};

type EvolutionGroupInfos = {
  id?: string;
  subject?: string;
  desc?: string | null;
  size?: number;
  creation?: number;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private apiUrl: string;
  private apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectQueue('whatsapp-queue')
    private whatsappQueue: Queue<SendMessageJobData | SendMediaJobData>,
    private readonly prisma: PrismaService,
  ) {
    this.apiUrl = this.configService.get<string>('EVOLUTION_API_URL') || '';
    this.apiKey = this.configService.get<string>('EVOLUTION_API_KEY') || '';
  }

  private buildHeaders() {
    return {
      apikey: this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private extractQrCode(data: unknown): string | null {
    if (!isRecord(data)) return null;

    const directBase64 =
      typeof data['base64'] === 'string' ? data['base64'] : null;
    if (directBase64) return directBase64;

    const directQrCode =
      typeof data['qrcode'] === 'string' ? data['qrcode'] : null;
    if (directQrCode) return directQrCode;

    const qrCode = isRecord(data['qrcode']) ? data['qrcode'] : undefined;
    const qrCodeBase64 =
      qrCode && typeof qrCode['base64'] === 'string' ? qrCode['base64'] : null;
    if (qrCodeBase64) return qrCodeBase64;

    const pairingCode =
      typeof data['pairingCode'] === 'string' ? data['pairingCode'] : null;
    if (pairingCode) return pairingCode;

    return null;
  }

  private extractPhone(data: unknown): string | null {
    if (!isRecord(data)) return null;

    const candidates: unknown[] = [
      data['number'],
      data['phone'],
      data['owner'],
      isRecord(data['instance']) ? data['instance']['number'] : undefined,
      isRecord(data['instance']) ? data['instance']['phone'] : undefined,
      isRecord(data['instance']) ? data['instance']['owner'] : undefined,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return null;
  }

  private isConnectedResponse(data: unknown): boolean {
    if (!isRecord(data)) return false;

    const directConnected = data['connected'];
    if (typeof directConnected === 'boolean') return directConnected;

    const directStatus = data['status'];
    if (
      typeof directStatus === 'string' &&
      ['open', 'connected', 'CONNECTED'].includes(directStatus)
    ) {
      return true;
    }

    const instance = isRecord(data['instance']) ? data['instance'] : undefined;
    if (instance) {
      const connected = instance['connected'];
      if (typeof connected === 'boolean') return connected;

      const status = instance['status'];
      if (
        typeof status === 'string' &&
        ['open', 'connected', 'CONNECTED'].includes(status)
      ) {
        return true;
      }
    }

    return false;
  }

  private async updateSessionState(
    instanceName: string,
    data: { status?: string; qrcode?: string | null; phone?: string | null },
  ) {
    await this.prisma.whatsappSession.updateMany({
      where: { name: instanceName },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.qrcode !== undefined ? { qrcode: data.qrcode } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
      },
    });
  }

  async getSessions(userId: string, projectId?: string) {
    return this.prisma.whatsappSession.findMany({
      where: {
        userId,
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSession(
    userId: string,
    instanceName: string,
    projectId?: string,
  ) {
    // Create session in DB if not exists
    const existing = await this.prisma.whatsappSession.findFirst({
      where: { userId, name: instanceName },
    });

    if (existing) {
      if (projectId && existing.projectId !== projectId) {
        return await this.prisma.whatsappSession.update({
          where: { id: existing.id },
          data: { projectId },
        });
      }
      return existing;
    }

    return this.prisma.whatsappSession.create({
      data: {
        userId,
        name: instanceName,
        status: 'DISCONNECTED',
        projectId,
      },
    });
  }

  async assignSessionToProject(data: {
    userId: string;
    instanceName: string;
    projectId: string | null;
  }) {
    const existing = await this.prisma.whatsappSession.findFirst({
      where: { userId: data.userId, name: data.instanceName },
    });
    if (!existing) {
      return await this.createSession(
        data.userId,
        data.instanceName,
        data.projectId ?? undefined,
      );
    }

    return await this.prisma.whatsappSession.update({
      where: { id: existing.id },
      data: {
        projectId: data.projectId,
      },
    });
  }

  async updateMessageStatusByProviderMessageId(data: {
    providerMessageId: string;
    status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  }) {
    await this.prisma.message.updateMany({
      where: { providerMessageId: data.providerMessageId },
      data: { status: data.status },
    });
  }

  async disconnectSession(userId: string, instanceName: string) {
    try {
      await this.prisma.whatsappSession.updateMany({
        where: { userId, name: instanceName },
        data: {
          status: 'DISCONNECTED',
          qrcode: null,
          phone: null,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Error disconnecting session: ${getErrorMessage(error)}`,
      );
    }
  }

  async connectInstance(instanceName: string) {
    try {
      const createResponse = await lastValueFrom(
        this.httpService.post<unknown>(
          `${this.apiUrl}/instance/create`,
          {
            instanceName,
            token: this.apiKey,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          },
          {
            headers: this.buildHeaders(),
          },
        ),
      );

      const createData = createResponse.data;
      const createQrCode = this.extractQrCode(createData);
      const createPhone = this.extractPhone(createData);
      const createConnected = this.isConnectedResponse(createData);

      if (createQrCode || createConnected) {
        await this.updateSessionState(instanceName, {
          status: createConnected ? 'CONNECTED' : 'QRCODE',
          qrcode: createQrCode,
          phone: createPhone,
        });

        return {
          ...(isRecord(createData) ? createData : {}),
          ...(createQrCode ? { base64: createQrCode } : {}),
          ...(createConnected ? { connected: true } : {}),
          ...(createPhone ? { phone: createPhone } : {}),
        };
      }

      const connectResponse = await lastValueFrom(
        this.httpService.get<unknown>(`${this.apiUrl}/instance/connect/${instanceName}`, {
          headers: this.buildHeaders(),
        }),
      );

      const connectData = connectResponse.data;
      const connectQrCode = this.extractQrCode(connectData);
      const connectPhone = this.extractPhone(connectData);
      const connectConnected = this.isConnectedResponse(connectData);

      await this.updateSessionState(instanceName, {
        status: connectConnected ? 'CONNECTED' : connectQrCode ? 'QRCODE' : 'DISCONNECTED',
        qrcode: connectQrCode,
        phone: connectPhone,
      });

      return {
        ...(isRecord(connectData) ? connectData : {}),
        ...(connectQrCode ? { base64: connectQrCode } : {}),
        ...(connectConnected ? { connected: true } : {}),
        ...(connectPhone ? { phone: connectPhone } : {}),
      };
    } catch (error: unknown) {
      const details =
        error instanceof AxiosError
          ? JSON.stringify(error.response?.data ?? {})
          : getErrorMessage(error);
      this.logger.error(`Error connecting instance: ${details}`);
      await this.updateSessionState(instanceName, {
        status: 'DISCONNECTED',
        qrcode: null,
      });
      throw error;
    }
  }

  async sendMessage(instanceName: string, number: string, text: string) {
    try {
      const response = await lastValueFrom(
        this.httpService.post<unknown>(
          `${this.apiUrl}/message/sendText/${instanceName}`,
          {
            number,
            options: {
              delay: 1200,
              presence: 'composing',
              linkPreview: false,
            },
            textMessage: {
              text,
            },
          },
          {
            headers: {
              apikey: this.apiKey,
            },
          },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error(`Error sending message: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async sendMedia(
    instanceName: string,
    number: string,
    payload: SendMediaPayload,
  ) {
    try {
      const response = await lastValueFrom(
        this.httpService.post<unknown>(
          `${this.apiUrl}/message/sendMedia/${instanceName}`,
          {
            number,
            mediatype: payload.mediaType,
            mimetype: payload.mimeType,
            caption: payload.caption ?? '',
            media: payload.media,
            fileName: payload.fileName,
          },
          {
            headers: {
              apikey: this.apiKey,
            },
          },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error(`Error sending media: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async fetchAllGroups(instanceName: string): Promise<EvolutionGroup[]> {
    try {
      const response = await lastValueFrom(
        this.httpService.get<EvolutionGroup[]>(
          `${this.apiUrl}/group/fetchAllGroups/${instanceName}`,
          {
            headers: {
              apikey: this.apiKey,
            },
          },
        ),
      );
      return response.data ?? [];
    } catch (error: unknown) {
      this.logger.error(`Error fetching groups: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async createGroup(params: {
    instanceName: string;
    subject: string;
    participants: string[];
  }) {
    try {
      const response = await lastValueFrom(
        this.httpService.post<unknown>(
          `${this.apiUrl}/group/createGroup/${params.instanceName}`,
          {
            subject: params.subject,
            participants: params.participants,
          },
          {
            headers: {
              apikey: this.apiKey,
            },
          },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error(`Error creating group: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async fetchInviteCode(params: { instanceName: string; groupJid: string }) {
    try {
      const response = await lastValueFrom(
        this.httpService.get<EvolutionInviteCode>(
          `${this.apiUrl}/group/inviteCode/${params.instanceName}`,
          {
            headers: {
              apikey: this.apiKey,
            },
            params: {
              groupJid: params.groupJid,
            },
          },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error(
        `Error fetching invite code: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async sendGroupInvite(params: {
    instanceName: string;
    groupJid: string;
    numbers: string[];
    description?: string;
  }) {
    try {
      const response = await lastValueFrom(
        this.httpService.post<unknown>(
          `${this.apiUrl}/group/sendGroupInvite/${params.instanceName}`,
          {
            groupJid: params.groupJid,
            numbers: params.numbers,
            description: params.description ?? '',
          },
          {
            headers: {
              apikey: this.apiKey,
            },
          },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error(
        `Error sending group invite: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async updateGroupParticipants(params: {
    instanceName: string;
    groupJid: string;
    action: 'add' | 'remove';
    participants: string[];
  }) {
    try {
      const response = await lastValueFrom(
        this.httpService.post<unknown>(
          `${this.apiUrl}/group/updateParticipant/${params.instanceName}`,
          {
            action: params.action,
            participants: params.participants,
          },
          {
            headers: {
              apikey: this.apiKey,
            },
            params: {
              groupJid: params.groupJid,
            },
          },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error(
        `Error updating group participants: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async updateGroupSubject(params: {
    instanceName: string;
    groupJid: string;
    subject: string;
  }) {
    try {
      const response = await lastValueFrom(
        this.httpService.post<unknown>(
          `${this.apiUrl}/group/updateGroupSubject/${params.instanceName}`,
          {
            subject: params.subject,
          },
          {
            headers: {
              apikey: this.apiKey,
            },
            params: {
              groupJid: params.groupJid,
            },
          },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error(
        `Error updating group subject: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async updateGroupDescription(params: {
    instanceName: string;
    groupJid: string;
    description: string;
  }) {
    try {
      const response = await lastValueFrom(
        this.httpService.post<unknown>(
          `${this.apiUrl}/group/updateGroupDescription/${params.instanceName}`,
          {
            description: params.description,
          },
          {
            headers: {
              apikey: this.apiKey,
            },
            params: {
              groupJid: params.groupJid,
            },
          },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error(
        `Error updating group description: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async fetchGroupInfos(params: { instanceName: string; groupJid: string }) {
    try {
      const response = await lastValueFrom(
        this.httpService.get<EvolutionGroupInfos>(
          `${this.apiUrl}/group/findGroupInfos/${params.instanceName}`,
          {
            headers: {
              apikey: this.apiKey,
            },
            params: {
              groupJid: params.groupJid,
            },
          },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error(
        `Error fetching group infos: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async recordIncomingMessageEvent(params: {
    instanceName: string;
    from: string;
    text: string;
  }) {
    try {
      const session = await this.prisma.whatsappSession.findFirst({
        where: { name: params.instanceName },
        select: { userId: true, projectId: true },
      });
      if (!session) return;

      const isGroup = params.from.endsWith('@g.us');
      let contactId: string | undefined;

      if (isGroup) {
        const group = await this.prisma.group.findFirst({
          where: {
            whatsappId: params.from,
            ...(session.projectId ? { projectId: session.projectId } : {}),
          },
          select: { name: true, projectId: true },
        });

        if (group) {
          const contact = await this.prisma.contact.findFirst({
            where: {
              userId: session.userId,
              phone: params.from,
              tags: { has: 'system:group' },
              ...(group.projectId ? { projectId: group.projectId } : {}),
            },
            select: { id: true },
          });

          if (contact) {
            contactId = contact.id;
          } else {
            const created = await this.prisma.contact.create({
              data: {
                userId: session.userId,
                name: group.name,
                phone: params.from,
                tags: ['system:group'],
                ...(group.projectId ? { projectId: group.projectId } : {}),
              },
              select: { id: true },
            });
            contactId = created.id;
          }
        }
      }

      await this.prisma.event.create({
        data: {
          type: 'WHATSAPP_INBOUND',
          source: 'whatsapp',
          userId: session.userId,
          ...(session.projectId ? { projectId: session.projectId } : {}),
          ...(contactId ? { contactId } : {}),
          metadata: {
            instanceName: params.instanceName,
            from: params.from,
            text: params.text,
          },
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Error recording incoming message event: ${getErrorMessage(error)}`,
      );
    }
  }

  async queueMessage(
    instanceName: string,
    number: string,
    text: string,
    delay = 5000,
    messageId?: string,
  ) {
    await this.whatsappQueue.add(
      'sendMessage',
      {
        instanceName,
        number,
        text,
        messageId,
      },
      {
        delay,
        removeOnComplete: true,
      },
    );
  }

  async queueMedia(
    instanceName: string,
    number: string,
    payload: SendMediaPayload,
    delay = 5000,
    messageId?: string,
  ) {
    await this.whatsappQueue.add(
      'sendMedia',
      {
        instanceName,
        number,
        payload,
        messageId,
      },
      {
        delay,
        removeOnComplete: true,
      },
    );
  }
}
