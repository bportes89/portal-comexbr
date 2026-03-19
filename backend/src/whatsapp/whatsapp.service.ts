import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
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
    private whatsappQueue: Queue<SendMessageJobData>,
    private readonly prisma: PrismaService,
  ) {
    this.apiUrl = this.configService.get<string>('EVOLUTION_API_URL') || '';
    this.apiKey = this.configService.get<string>('EVOLUTION_API_KEY') || '';
  }

  async getSessions(userId: string) {
    return this.prisma.whatsappSession.findMany({
      where: { userId },
    });
  }

  async createSession(userId: string, instanceName: string) {
    // Create session in DB if not exists
    const existing = await this.prisma.whatsappSession.findFirst({
      where: { userId, name: instanceName },
    });

    if (existing) return existing;

    return this.prisma.whatsappSession.create({
      data: {
        userId,
        name: instanceName,
        status: 'DISCONNECTED',
      },
    });
  }

  async connectInstance(instanceName: string) {
    try {
      // Check if instance exists or create new one
      // For simplicity, we try to create it. If it exists, Evolution API might return error or existing info.
      const response = await lastValueFrom(
        this.httpService.post<unknown>(
          `${this.apiUrl}/instance/create`,
          {
            instanceName,
            token: '',
            qrcode: true,
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
      this.logger.error(`Error connecting instance: ${getErrorMessage(error)}`);
      // In production, handle specific errors (e.g., instance already exists)
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

  async queueMessage(
    instanceName: string,
    number: string,
    text: string,
    delay = 5000,
  ) {
    await this.whatsappQueue.add(
      'sendMessage',
      {
        instanceName,
        number,
        text,
      },
      {
        delay,
        removeOnComplete: true,
      },
    );
  }
}
