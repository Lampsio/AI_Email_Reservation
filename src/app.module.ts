// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GmailModule } from './gmail/gmail.module'; // Za chwilę utworzymy
import { TravelAnalysisModule } from './travel-analysis/travel-analysis.module';
import { CalendarModule } from './calendar/calendar.module';
import { SendGmailService } from './send-gmail/send-gmail.service';
import { SendGmailModule } from './send-gmail/send-gmail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, 
    }),
    GmailModule,
    TravelAnalysisModule,
    CalendarModule,
    SendGmailModule, 
  ],
  controllers: [],
  providers: [SendGmailService],
})
export class AppModule {}