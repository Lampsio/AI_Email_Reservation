// src/gmail/gmail.controller.ts
import { Controller, Get, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { GmailService, ProcessedEmailData } from './gmail.service'; 

@Controller('gmail')
export class GmailController {
  private readonly logger = new Logger(GmailController.name);

  constructor(private readonly gmailService: GmailService) {}

  @Get('process-first-unread') 
  async processFirstUnreadEmail(): Promise<ProcessedEmailData> { 
    this.logger.log('Received request to process first unread email (analyze, book, reply)');
    try {
      const processedData = await this.gmailService.findAnalyzeBookAndReplyFirstUnread();
      return processedData;
    } catch (error) {
       this.logger.error(`Error in controller while processing email: ${error.message}`, error.stack);
       throw new HttpException(
            error.message || 'Failed to process first unread email',
            HttpStatus.INTERNAL_SERVER_ERROR,
       );
    }
  }
}