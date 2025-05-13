import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SendGmailService } from './send-gmail.service';

@Module({
  imports: [ConfigModule], 
  providers: [SendGmailService],
  exports: [SendGmailService], 
})
export class SendGmailModule {}