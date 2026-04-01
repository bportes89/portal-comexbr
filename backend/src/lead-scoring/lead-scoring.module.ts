import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LeadScoringController } from './lead-scoring.controller';
import { LeadScoringService } from './lead-scoring.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AutomationsModule } from '../automations/automations.module';

@Module({
  imports: [PrismaModule, HttpModule, AutomationsModule],
  controllers: [LeadScoringController],
  providers: [LeadScoringService],
  exports: [LeadScoringService],
})
export class LeadScoringModule {}
