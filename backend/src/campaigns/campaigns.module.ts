import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    WhatsappModule,
    BullModule.registerQueue({
      name: 'whatsapp-queue',
    }),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
