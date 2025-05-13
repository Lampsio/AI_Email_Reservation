// src/gmail/gmail.module.ts
import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';
import { ConfigModule } from '@nestjs/config';
import { TravelAnalysisModule } from '../travel-analysis/travel-analysis.module';
import { CalendarModule } from '../calendar/calendar.module';
import { SendGmailModule } from '../send-gmail/send-gmail.module'; 

@Module({
  imports: [
    ConfigModule,
    TravelAnalysisModule,
    CalendarModule,
    SendGmailModule,
  ],
  providers: [GmailService],
  controllers: [GmailController],
  exports: [GmailService],
})
export class GmailModule {}