import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ContactsModule } from './contacts/contacts.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { AutomationsModule } from './automations/automations.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { GroupsModule } from './groups/groups.module';
import { ProjectsModule } from './projects/projects.module';
import { LeadScoringModule } from './lead-scoring/lead-scoring.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { TemplatesModule } from './templates/templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl) {
          const parsed = new URL(redisUrl);
          const port =
            parsed.port && !Number.isNaN(Number(parsed.port))
              ? Number(parsed.port)
              : 6379;

          const password = parsed.password ? parsed.password : undefined;
          const tls = parsed.protocol === 'rediss:' ? {} : undefined;

          return {
            connection: {
              host: parsed.hostname,
              port,
              password,
              tls,
            },
          };
        }

        const host = configService.get<string>('REDIS_HOST');
        const port = Number(configService.get<string>('REDIS_PORT') ?? 6379);

        return {
          connection: {
            host,
            port: Number.isNaN(port) ? 6379 : port,
          },
        };
      },
      inject: [ConfigService],
    }),
    PrismaModule,
    WhatsappModule,
    ContactsModule,
    CampaignsModule,
    AutomationsModule,
    GroupsModule,
    ProjectsModule,
    LeadScoringModule,
    IntegrationsModule,
    AnalyticsModule,
    TemplatesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
