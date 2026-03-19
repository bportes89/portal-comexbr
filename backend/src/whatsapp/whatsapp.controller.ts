import { Controller, Post, Body, Logger, Get, Query } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { AutomationsService } from '../automations/automations.service';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly automationsService: AutomationsService,
  ) {}

  @Post('connect')
  async connect(
    @Body('instanceName') instanceName: string,
    @Body('userId') userId: string,
  ): Promise<unknown> {
    try {
      if (userId) {
        await this.whatsappService.createSession(userId, instanceName);
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

  @Get('sessions')
  async getSessions(@Query('userId') userId: string) {
    if (!userId) return [];
    try {
      return await this.whatsappService.getSessions(userId);
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

  @Post('send')
  async sendMessage(
    @Body('instanceName') instanceName: string,
    @Body('number') number: string,
    @Body('text') text: string,
  ) {
    await this.whatsappService.queueMessage(instanceName, number, text);
    return { status: 'queued' };
  }

  @Post('webhook')
  async handleWebhook(@Body() payload: unknown): Promise<void> {
    this.logger.log('Received webhook', JSON.stringify(payload));

    if (!isRecord(payload)) return;
    if (payload.type !== 'messages-upsert') return;

    const instanceName =
      typeof payload.instance === 'string' ? payload.instance : undefined;
    if (!instanceName) return;

    const data = payload.data;
    let messageCandidate: unknown = data;
    if (isRecord(data) && 'message' in data) {
      messageCandidate = data.message;
    }
    if (!isRecord(messageCandidate)) return;

    const key = isRecord(messageCandidate.key)
      ? messageCandidate.key
      : undefined;
    const remoteJid =
      key && typeof key.remoteJid === 'string' ? key.remoteJid : undefined;
    const fromMe =
      key && typeof key.fromMe === 'boolean' ? key.fromMe : undefined;
    if (!remoteJid || fromMe) return;

    const msg = isRecord(messageCandidate.message)
      ? messageCandidate.message
      : undefined;
    if (!msg) return;

    let text: string | undefined;
    if (typeof msg.conversation === 'string') {
      text = msg.conversation;
    } else if (
      isRecord(msg.extendedTextMessage) &&
      typeof msg.extendedTextMessage.text === 'string'
    ) {
      text = msg.extendedTextMessage.text;
    }
    if (!text) return;

    const phone = remoteJid.split('@')[0] ?? '';
    if (!phone) return;

    await this.automationsService.processIncomingMessage(
      phone,
      text,
      instanceName,
    );
  }
}
