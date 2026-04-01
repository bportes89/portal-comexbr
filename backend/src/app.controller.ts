import { Controller, Get, Query } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue('whatsapp-queue')
    private readonly whatsappQueue: Queue,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('system/status')
  async getSystemStatus() {
    const withTimeout = async <T>(promise: Promise<T>, ms: number) => {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), ms),
        ),
      ]);
    };

    let databaseOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseOk = true;
    } catch {
      databaseOk = false;
    }

    let queueOk = false;
    try {
      await withTimeout(this.whatsappQueue.getJobCounts(), 800);
      queueOk = true;
    } catch {
      queueOk = false;
    }

    const apiUrl = this.configService.get<string>('EVOLUTION_API_URL') ?? '';
    const apiKey = this.configService.get<string>('EVOLUTION_API_KEY') ?? '';
    const whatsappConfigured = Boolean(apiUrl) && Boolean(apiKey);

    return {
      whatsappApi: { configured: whatsappConfigured },
      messageQueue: { ok: queueOk },
      database: { ok: databaseOk },
    };
  }

  @Get('audit/logs')
  async listAuditLogs(
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
    @Query('take') take?: string,
    @Query('action') action?: string,
  ) {
    if (!userId) return [];
    try {
      const takeNum = take ? Number(take) : 50;
      const safeTake =
        Number.isFinite(takeNum) && takeNum > 0 ? Math.min(takeNum, 200) : 50;

      return await this.prisma.auditLog.findMany({
        where: {
          userId,
          ...(projectId ? { projectId } : {}),
          ...(action ? { action } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: safeTake,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          projectId: true,
          createdAt: true,
        },
      });
    } catch {
      return [];
    }
  }
}
