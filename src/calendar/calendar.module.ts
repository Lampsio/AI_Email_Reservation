import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CalendarService } from './calendar.service';

@Module({
  imports: [ConfigModule], 
  providers: [CalendarService],
  exports: [CalendarService], 
})
export class CalendarModule {}