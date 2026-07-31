import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { lastValueFrom } from 'rxjs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { isMessageQueueEnabled } from '../queue/message-queue.state';
import { normalizeWhatsAppNumber } from './phone.util';
import { WhatsAppNotConnectedError } from './whatsapp.errors';
import { assertSendTextSuccess } from './whatsapp-send.util';

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
      data['ownerJid'],
      isRecord(data['instance']) ? data['instance']['number'] : undefined,
      isRecord(data['instance']) ? data['instance']['phone'] : undefined,
      isRecord(data['instance']) ? data['instance']['owner'] : undefined,
      isRecord(data['instance']) ? data['instance']['ownerJid'] : undefined,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        const value = candidate.trim();
        const ownerMatch = /^(\d+)@/.exec(value);
        if (ownerMatch) return ownerMatch[1];
        return value;
      }
    }

    return null;
  }

  private isConnectedResponse(data: unknown): boolean {
    if (!isRecord(data)) return false;

    const connectionStatus = data['connectionStatus'];
    if (
      typeof connectionStatus === 'string' &&
      connectionStatus.toLowerCase() === 'open'
    ) {
      return true;
    }

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
      const instanceConnectionStatus = instance['connectionStatus'];
      if (
        typeof instanceConnectionStatus === 'string' &&
        instanceConnectionStatus.toLowerCase() === 'open'
      ) {
        return true;
      }

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

  private extractConnectionState(data: unknown): string | null {
    if (!isRecord(data)) return null;

    const candidates: unknown[] = [
      data['connectionStatus'],
      data['state'],
      data['status'],
      isRecord(data['instance']) ? data['instance']['connectionStatus'] : undefined,
      isRecord(data['instance']) ? data['instance']['state'] : undefined,
      isRecord(data['instance']) ? data['instance']['status'] : undefined,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim().toLowerCase();
      }
    }

    return null;
  }

  private mapConnectionStateToSessionStatus(state: string | null): string {
    if (state === 'open' || state === 'connected') return 'CONNECTED';
    if (state === 'connecting') return 'QRCODE';
    if (state === 'close' || state === 'closed' || state === 'disconnected') {
      return 'DISCONNECTED';
    }
    return 'DISCONNECTED';
  }

  async ensureInstanceConnected(instanceName: string) {
    await this.syncSessionWithEvolution(instanceName);
    const snapshot = await this.fetchEvolutionConnectionSnapshot(instanceName);
    const state = snapshot.state?.toLowerCase() ?? null;

    if (state === 'open' || state === 'connected') {
      return true;
    }

    throw new WhatsAppNotConnectedError(instanceName);
  }

  private extractInstanceSnapshot(
    data: unknown,
    instanceName: string,
  ): { state: string | null; phone: string | null } | null {
    const candidates: unknown[] = [];

    if (Array.isArray(data)) {
      candidates.push(...data);
    } else if (isRecord(data)) {
      candidates.push(data);

      if (Array.isArray(data['instances'])) {
        candidates.push(...data['instances']);
      }

      if (Array.isArray(data['data'])) {
        candidates.push(...data['data']);
      } else if (data['data']) {
        candidates.push(data['data']);
      }

      if (data['instance']) {
        candidates.push(data['instance']);
      }
    }

    for (const candidate of candidates) {
      if (!isRecord(candidate)) continue;

      const candidateName =
        typeof candidate['name'] === 'string'
          ? candidate['name']
          : typeof candidate['instanceName'] === 'string'
            ? candidate['instanceName']
            : null;

      if (candidateName && candidateName !== instanceName) continue;

      const state = this.extractConnectionState(candidate);
      const phone = this.extractPhone(candidate);

      if (state || phone || candidateName === instanceName) {
        return { state, phone };
      }
    }

    return null;
  }

  private async fetchEvolutionConnectionSnapshot(instanceName: string) {
    const attempts: Array<() => Promise<unknown>> = [
      async () =>
        (
          await lastValueFrom(
            this.httpService.get<unknown>(
              `${this.apiUrl}/instance/connectionState/${instanceName}`,
              {
                headers: this.buildHeaders(),
              },
            ),
          )
        ).data,
      async () =>
        (
          await lastValueFrom(
            this.httpService.get<unknown>(
              `${this.apiUrl}/instance/connectionState`,
              {
                headers: this.buildHeaders(),
                params: { instanceName },
              },
            ),
          )
        ).data,
      async () =>
        (
          await lastValueFrom(
            this.httpService.get<unknown>(
              `${this.apiUrl}/instance/fetchInstances`,
              {
                headers: this.buildHeaders(),
                params: { instanceName },
              },
            ),
          )
        ).data,
      async () =>
        (
          await lastValueFrom(
            this.httpService.get<unknown>(
              `${this.apiUrl}/instance/fetchInstances`,
              {
                headers: this.buildHeaders(),
              },
            ),
          )
        ).data,
    ];

    let lastError: unknown;

    for (const attempt of attempts) {
      try {
        const data = await attempt();
        const snapshot = this.extractInstanceSnapshot(data, instanceName);
        if (snapshot) return snapshot;
      } catch (error: unknown) {
        lastError = error;
      }
    }

    throw (
      lastError ?? new Error('Failed to fetch instance state from Evolution')
    );
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

  private async syncSessionWithEvolution(instanceName: string) {
    try {
      const snapshot =
        await this.fetchEvolutionConnectionSnapshot(instanceName);
      const state = snapshot.state;
      const status = this.mapConnectionStateToSessionStatus(state);

      await this.updateSessionState(instanceName, {
        status,
        qrcode: status === 'CONNECTED' ? null : undefined,
        phone: status === 'CONNECTED' ? snapshot.phone : undefined,
      });
    } catch (error: unknown) {
      const axiosError = error instanceof AxiosError ? error : undefined;
      const status = axiosError?.response?.status;

      if (status === 404) {
        await this.updateSessionState(instanceName, {
          status: 'DISCONNECTED',
          qrcode: null,
          phone: null,
        });
        return;
      }

      const details = axiosError
        ? JSON.stringify(axiosError.response?.data ?? {})
        : getErrorMessage(error);
      this.logger.warn(
        `Error syncing session ${instanceName} with Evolution: ${details}`,
      );
    }
  }

  async getSessions(userId: string, projectId?: string) {
    const sessions = await this.prisma.whatsappSession.findMany({
      where: {
        userId,
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    await Promise.all(
      sessions.map((session) => this.syncSessionWithEvolution(session.name)),
    );

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

  private isInstanceAlreadyExistsError(error: unknown): boolean {
    if (!(error instanceof AxiosError)) return false;

    const status = error.response?.status;
    if (status === 403) return true;

    const data = error.response?.data;
    if (!isRecord(data)) return false;

    const response = isRecord(data['response']) ? data['response'] : undefined;
    const message = response?.['message'];
    if (!Array.isArray(message)) return false;

    return message.some(
      (item) =>
        typeof item === 'string' &&
        item.toLowerCase().includes('already in use'),
    );
  }

  private async buildConnectResult(
    instanceName: string,
    data: unknown,
  ): Promise<Record<string, unknown>> {
    const qrCode = this.extractQrCode(data);
    const phone = this.extractPhone(data);
    const connected = this.isConnectedResponse(data);

    await this.updateSessionState(instanceName, {
      status: connected ? 'CONNECTED' : qrCode ? 'QRCODE' : 'DISCONNECTED',
      qrcode: qrCode,
      phone,
    });

    return {
      ...(isRecord(data) ? data : {}),
      ...(qrCode ? { base64: qrCode } : {}),
      ...(connected ? { connected: true } : {}),
      ...(phone ? { phone } : {}),
    };
  }

  async connectInstance(instanceName: string) {
    try {
      let createData: unknown = null;

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
        createData = createResponse.data;
      } catch (error: unknown) {
        if (!this.isInstanceAlreadyExistsError(error)) {
          throw error;
        }
        this.logger.warn(
          `Instance "${instanceName}" already exists; requesting connect.`,
        );
      }

      if (createData) {
        const createQrCode = this.extractQrCode(createData);
        const createConnected = this.isConnectedResponse(createData);
        if (createQrCode || createConnected) {
          return await this.buildConnectResult(instanceName, createData);
        }
      }

      const connectResponse = await lastValueFrom(
        this.httpService.get<unknown>(
          `${this.apiUrl}/instance/connect/${instanceName}`,
          {
            headers: this.buildHeaders(),
          },
        ),
      );

      return await this.buildConnectResult(instanceName, connectResponse.data);
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

  async validateWhatsAppNumbers(instanceName: string, numbers: string[]) {
    const normalized = numbers.map((number) => normalizeWhatsAppNumber(number));

    try {
      const response = await lastValueFrom(
        this.httpService.post<unknown>(
          `${this.apiUrl}/chat/whatsappNumbers/${instanceName}`,
          { numbers: normalized },
          { headers: this.buildHeaders() },
        ),
      );

      const payload = response.data;
      if (!Array.isArray(payload)) return normalized;

      const invalid = payload
        .filter((entry) => isRecord(entry) && entry.exists === false)
        .map((entry) =>
          isRecord(entry) && typeof entry.number === 'string'
            ? entry.number
            : 'desconhecido',
        );

      if (invalid.length > 0) {
        throw new Error(
          `Número(s) não possuem WhatsApp: ${invalid.join(', ')}`,
        );
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('não possuem WhatsApp')) {
        throw error;
      }
      this.logger.warn(
        `Validação de números ignorada: ${getErrorMessage(error)}`,
      );
    }

    return normalized;
  }

  async sendMessage(instanceName: string, number: string, text: string) {
    await this.ensureInstanceConnected(instanceName);
    const normalizedNumber = normalizeWhatsAppNumber(number);
    await this.validateWhatsAppNumbers(instanceName, [normalizedNumber]);

    try {
      const response = await lastValueFrom(
        this.httpService.post<unknown>(
          `${this.apiUrl}/message/sendText/${instanceName}`,
          {
            number: normalizedNumber,
            text,
            delay: 1200,
            presence: 'composing',
            linkPreview: false,
          },
          {
            headers: this.buildHeaders(),
          },
        ),
      );
      const providerMessageId = assertSendTextSuccess(response.data);
      return { ...(isRecord(response.data) ? response.data : {}), providerMessageId };
    } catch (error: unknown) {
      const details =
        error instanceof AxiosError
          ? JSON.stringify(error.response?.data ?? {})
          : getErrorMessage(error);
      this.logger.error(`Error sending message: ${details}`);
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
    if (!isMessageQueueEnabled()) {
      if (delay > 0) {
        setTimeout(() => void this.sendMessage(instanceName, number, text), delay);
        return;
      }
      await this.sendMessage(instanceName, number, text);
      return;
    }

    try {
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
    } catch (error) {
      this.logger.warn(`Fila indisponível, enviando direto: ${error}`);
      await this.sendMessage(instanceName, number, text);
    }
  }

  async queueMedia(
    instanceName: string,
    number: string,
    payload: SendMediaPayload,
    delay = 5000,
    messageId?: string,
  ) {
    if (!isMessageQueueEnabled()) {
      if (delay > 0) {
        setTimeout(
          () => void this.sendMedia(instanceName, number, payload),
          delay,
        );
        return;
      }
      await this.sendMedia(instanceName, number, payload);
      return;
    }

    try {
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
    } catch (error) {
      this.logger.warn(`Fila indisponível, enviando mídia direto: ${error}`);
      await this.sendMedia(instanceName, number, payload);
    }
  }
}
