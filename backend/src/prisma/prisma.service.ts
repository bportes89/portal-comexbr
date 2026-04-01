import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = configService.get<string>('DATABASE_URL');
    const pool = new Pool({
      connectionString: databaseUrl,
    });

    super({
      adapter: new PrismaPg(pool),
    });

    this.pool = pool;
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error: unknown) {
      this.logger.error(error);
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch (error: unknown) {
      this.logger.error(error);
    }
    try {
      await this.pool.end();
    } catch (error: unknown) {
      this.logger.error(error);
    }
  }
}
