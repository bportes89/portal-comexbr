import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LeadScoringModule } from '../lead-scoring/lead-scoring.module';

@Module({
  imports: [PrismaModule, LeadScoringModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
})
export class IntegrationsModule {}
