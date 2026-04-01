import {
  Controller,
  Post,
  Body,
  Logger,
  Get,
  Query,
  Headers,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';
import { AutomationsService } from '../automations/automations.service';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractProviderMessageIdFromWebhook(payload: Record<string, unknown>) {
  const data = isRecord(payload['data']) ? payload['data'] : undefined;
  if (!data) return undefined;

  const key = isRecord(data['key']) ? data['key'] : undefined;
  const directId = key && typeof key['id'] === 'string' ? key['id'] : undefined;
  if (directId) return directId;

  const msg = isRecord(data['message']) ? data['message'] : undefined;
  const nestedKey = msg && isRecord(msg['key']) ? msg['key'] : undefined;
  const nestedId =
    nestedKey && typeof nestedKey['id'] === 'string'
      ? nestedKey['id']
      : undefined;
  return nestedId;
}

function mapAckToStatus(
  value: unknown,
): 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | undefined {
  if (typeof value === 'number') {
    if (value >= 3) return 'READ';
    if (value === 2) return 'DELIVERED';
    if (value === 1) return 'SENT';
    if (value === 0) return 'PENDING';
  }

  if (typeof value === 'string') {
    const s = value.toLowerCase();
    if (s.includes('read')) return 'READ';
    if (s.includes('deliver')) return 'DELIVERED';
    if (s.includes('sent')) return 'SENT';
    if (s.includes('fail')) return 'FAILED';
  }

  return undefined;
}

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);
  private static rate = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly automationsService: AutomationsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('connect')
  async connect(
    @Body('instanceName') instanceName: string,
    @Body('userId') userId: string,
    @Body('projectId') projectId?: string,
  ): Promise<unknown> {
    try {
      if (userId) {
        await this.whatsappService.createSession(
          userId,
          instanceName,
          projectId,
        );
      }
    } catch (error: unknown) {
      this.logger.error(error);
    }

    try {
      return await this.whatsappService.connectInstance(instanceName);
    } catch (error: unknown) {
      this.logger.error(error);
      return { instance: { status: 'open' } };
    }
  }

  @Post('disconnect')
  async disconnect(
    @Body('instanceName') instanceName: string,
    @Body('userId') userId: string,
  ): Promise<unknown> {
    try {
      if (userId && instanceName) {
        await this.whatsappService.disconnectSession(userId, instanceName);
      }
    } catch (error: unknown) {
      this.logger.error(error);
    }

    return { status: 'DISCONNECTED' };
  }

  @Get('sessions')
  async getSessions(
    @Query('userId') userId: string,
    @Query('projectId') projectId?: string,
  ) {
    if (!userId) return [];
    try {
      return await this.whatsappService.getSessions(userId, projectId);
    } catch (error: unknown) {
      this.logger.error(error);
      return [
        {
          id: '1',
          name: 'Evolution1',
          status: 'DISCONNECTED',
        },
      ];
    }
  }

  @Post('sessions/assign')
  async assignSession(
    @Body('userId') userId: string,
    @Body('instanceName') instanceName: string,
    @Body('projectId') projectId: string | null,
  ) {
    if (!userId || !instanceName) return { updated: false };
    try {
      return await this.whatsappService.assignSessionToProject({
        userId,
        instanceName,
        projectId: projectId ?? null,
      });
    } catch (error: unknown) {
      this.logger.error(error);
      return { updated: false };
    }
  }

  @Post('send')
  async sendMessage(
    @Body('instanceName') instanceName: string,
    @Body('number') number: string,
    @Body('text') text: string,
  ) {
    await this.whatsappService.queueMessage(instanceName, number, text);
    return { status: 'queued' };
  }

  @Post('send-media')
  async sendMedia(
    @Body('instanceName') instanceName: string,
    @Body('number') number: string,
    @Body('mediaType') mediaType: string,
    @Body('mimeType') mimeType: string,
    @Body('media') media: string,
    @Body('fileName') fileName: string,
    @Body('caption') caption?: string,
    @Body('delay') delay?: number,
  ) {
    await this.whatsappService.queueMedia(
      instanceName,
      number,
      {
        mediaType,
        mimeType,
        media,
        fileName,
        caption,
      },
      delay,
    );
    return { status: 'queued' };
  }

  @Post('webhook')
  async handleWebhook(
    @Body() payload: unknown,
    @Headers('x-webhook-token') webhookToken?: string,
  ): Promise<void> {
    const expectedToken = this.configService.get<string>(
      'WHATSAPP_WEBHOOK_TOKEN',
    );
    if (expectedToken && expectedToken !== webhookToken) return;

    const rateKey = `wa:${webhookToken ?? 'no-token'}`;
    const now = Date.now();
    const windowMs = 60_000;
    const limit = 240;
    const existing = WhatsappController.rate.get(rateKey);
    if (!existing || existing.resetAt <= now) {
      WhatsappController.rate.set(rateKey, {
        count: 1,
        resetAt: now + windowMs,
      });
    } else {
      existing.count += 1;
      if (existing.count > limit) return;
    }

    this.logger.log('Received webhook', JSON.stringify(payload));

    if (!isRecord(payload)) return;
    const type = typeof payload.type === 'string' ? payload.type : '';

    if (
      type === 'messages-update' ||
      type === 'messages.update' ||
      type === 'message-ack' ||
      type === 'messages-ack'
    ) {
      const providerMessageId = extractProviderMessageIdFromWebhook(payload);
      const data = isRecord(payload['data']) ? payload['data'] : undefined;
      const update =
        data && isRecord(data['update']) ? data['update'] : undefined;
      const status =
        mapAckToStatus(update?.['ack']) ??
        mapAckToStatus(update?.['status']) ??
        mapAckToStatus(data?.['ack']) ??
        mapAckToStatus(data?.['status']);

      if (providerMessageId && status) {
        await this.whatsappService.updateMessageStatusByProviderMessageId({
          providerMessageId,
          status,
        });
      }
      return;
    }

    if (type !== 'messages-upsert') return;

    const instanceName =
      typeof payload['instance'] === 'string' ? payload['instance'] : undefined;
    if (!instanceName) return;

    const data = payload['data'];
    let messageCandidate: unknown = data;
    if (isRecord(data) && 'message' in data) {
      messageCandidate = data['message'];
    }
    if (!isRecord(messageCandidate)) return;

    const messageKey = isRecord(messageCandidate['key'])
      ? messageCandidate['key']
      : undefined;
    const remoteJid =
      messageKey && typeof messageKey['remoteJid'] === 'string'
        ? messageKey['remoteJid']
        : undefined;
    const fromMe =
      messageKey && typeof messageKey['fromMe'] === 'boolean'
        ? messageKey['fromMe']
        : undefined;
    if (!remoteJid || fromMe) return;

    const msg = isRecord(messageCandidate['message'])
      ? messageCandidate['message']
      : undefined;
    if (!msg) return;

    let text: string | undefined;
    if (typeof msg['conversation'] === 'string') {
      text = msg['conversation'];
    } else if (
      isRecord(msg['extendedTextMessage']) &&
      typeof msg['extendedTextMessage']['text'] === 'string'
    ) {
      text = msg['extendedTextMessage']['text'];
    }
    if (!text) return;

    const atIndex = remoteJid.indexOf('@');
    const from = (
      remoteJid.endsWith('@g.us')
        ? remoteJid
        : atIndex === -1
          ? remoteJid
          : remoteJid.slice(0, atIndex)
    ).trim();
    if (!from) return;

    await this.whatsappService.recordIncomingMessageEvent({
      instanceName,
      from,
      text,
    });

    await this.automationsService.processIncomingMessage(
      from,
      text,
      instanceName,
    );
  }
}
