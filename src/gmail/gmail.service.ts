// src/gmail/gmail.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { decode } from 'he';
import { TravelAnalysisService, JapanTourAnalysis } from '../travel-analysis/travel-analysis.service';
import { CalendarService, CalendarBookingResult } from '../calendar/calendar.service';
import { SendGmailService, SendEmailResult } from '../send-gmail/send-gmail.service'; 

interface EmailData {
  id?: string; 
  threadId?: string;
  snippet?: string;
  subject: string;
  from: { name: string; email: string }; 
  date: string;
  body: string;
}

export interface ProcessedEmailData extends EmailData {
  analysis?: JapanTourAnalysis;
  bookingResult?: CalendarBookingResult;
  replyResult?: SendEmailResult; 
}

@Injectable()
export class GmailService implements OnModuleInit {
  private readonly logger = new Logger(GmailService.name);
  private gmail: gmail_v1.Gmail;
  private oAuth2Client: OAuth2Client;

  constructor(
    private configService: ConfigService,
    private travelAnalysisService: TravelAnalysisService,
    private calendarService: CalendarService,
    private sendGmailService: SendGmailService, 
  ) {}

  async onModuleInit() {
    this.initializeGmailClient();
  }
   private initializeGmailClient() {
    
    const clientId = this.configService.get<string>('GMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GMAIL_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('GMAIL_REFRESH_TOKEN');
    const redirectUri = this.configService.get<string>('GMAIL_REDIRECT_URI');

    if (!clientId || !clientSecret || !refreshToken || !redirectUri) {
      this.logger.error('Missing Google API credentials in .env file');
      throw new Error('Missing Google API credentials');
    }
     this.logger.warn(
       'Ensure the GMAIL_REFRESH_TOKEN was obtained with appropriate scopes for: Gmail Read/Modify, Calendar Events, AND Gmail Send/Compose.',
     );


    this.oAuth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    this.oAuth2Client.setCredentials({
      refresh_token: refreshToken,
    });

  
    this.gmail = google.gmail({
      version: 'v1',
      auth: this.oAuth2Client,
    });

     this.logger.log('Base Gmail client initialized (reusing OAuth2 client for other services).');
  }

  private decodeEmailBody(message: gmail_v1.Schema$Message): string { 
    const payload = message.payload;
    if (!payload) return 'Brak treści wiadomości';

    const decodePart = (part: gmail_v1.Schema$MessagePart): string => {
      if (!part?.body?.data) return '';
      try {
        const sanitizedData = part.body.data
          .replace(/-/g, '+')
          .replace(/_/g, '/');
        return Buffer.from(sanitizedData, 'base64').toString('utf-8');
      } catch (error) {
        this.logger.error('Decoding error:', error);
        return '';
      }
    };

     if (payload.parts) {
      const plainPart = payload.parts.find(part => part.mimeType === 'text/plain');
      if (plainPart) return decodePart(plainPart);
      const htmlPart = payload.parts.find(part => part.mimeType === 'text/html');
      if (htmlPart) return decodePart(htmlPart).replace(/<[^>]*>/g, ' '); 
      return payload.parts.map(decodePart).join('\n');
    }
    return decodePart(payload);
  }
  private parseSender(rawFrom: string): { name: string; email: string } {
    if (!rawFrom) return { name: 'Unknown', email: '' };
    const decodedFrom = decode(rawFrom); 
    const emailMatch = decodedFrom.match(/<([^>]+)>/);
    
    const email = emailMatch?.[1] || decodedFrom.trim();
    const name = decodedFrom.replace(/<[^>]+>/, '').trim() || email.split('@')[0];
    return { name, email };
  }
  private cleanEmailBody(body: string): string { 
    return body
      .replace(/=3D/g, '=')
      .replace(/=E2=80=99/g, "'")
      .replace(/=20/g, ' ')
      .replace(/(\r\n|\r|\n)+/g, '\n') 
      .replace(/\s+/g, ' ')
      .trim();
  }

  async findAnalyzeBookAndReplyFirstUnread(): Promise<ProcessedEmailData> {
    
    if (!this.gmail) throw new Error('Gmail client not ready');
     try {
      this.logger.log('Searching for unread emails...');
      const listRes = await this.gmail.users.messages.list({ userId: 'me', q: 'is:unread label:inbox', maxResults: 1 });
      if (!listRes.data.messages?.length) {
          this.logger.log('No unread messages found.');
          return { 
              subject: 'No unread messages', from: { name: 'System', email: '' }, date: new Date().toISOString(), body: '',
              analysis: { isJapanTourGuideReservation: false, startDate: null, endDate: null, reasoning: 'No unread messages found.' },
              bookingResult: { available: false, booked: false, message: 'No email processed.'},
              replyResult: { success: false, message: 'No email processed.' }
          };
      }
      const messageId = listRes.data.messages[0].id!;
      const messageDetails = await this.gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full', fields: 'id,threadId,snippet,payload(headers,parts,body,mimeType)' });
       if (!messageDetails.data) throw new Error(`Could not retrieve details for message ID: ${messageId}`);
       if (!messageDetails.data.threadId) throw new Error(`Could not retrieve Thread ID for message ID: ${messageId}`); 

      const headers = messageDetails.data.payload?.headers || [];
      const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
      const rawBody = this.decodeEmailBody(messageDetails.data as gmail_v1.Schema$Message);
      const bodyToAnalyze = this.cleanEmailBody(rawBody);

      const senderInfo = this.parseSender(getHeader('From'));
      const emailData: EmailData = {
        id: messageDetails.data.id ?? undefined, 
        threadId: messageDetails.data.threadId,  
        snippet: decode(messageDetails.data.snippet || ''),
        subject: decode(getHeader('Subject')),
        from: senderInfo, 
        date: getHeader('Date'),
        body: bodyToAnalyze,
      };

      
      if (!emailData.id || !emailData.threadId || !emailData.from.email || !emailData.subject) {
           this.logger.error(`Missing essential data for processing/replying to message ${messageId}: ID, ThreadID, FromEmail, or Subject.`);
           await this.markAsRead(messageId);
           throw new Error(`Incomplete email data for message ${messageId}, cannot process fully.`);
      }


      
      let analysisResult: JapanTourAnalysis | undefined;
      
       if (emailData.body && emailData.body.trim() !== '') {
        try {
            analysisResult = await this.travelAnalysisService.analyzeEmailForJapanTour(emailData.body);
        } catch (analysisError) {
            this.logger.error(`Analysis failed for email ${messageId}: ${analysisError.message}`);
            analysisResult = { isJapanTourGuideReservation: false, startDate: null, endDate: null, reasoning: `Analysis failed: ${analysisError.message}` };
        }
      } else {
         analysisResult = { isJapanTourGuideReservation: false, startDate: null, endDate: null, reasoning: 'Email body was empty.' };
      }

      
      let bookingResultData: CalendarBookingResult | undefined;
      
       if (analysisResult?.isJapanTourGuideReservation && analysisResult.startDate && analysisResult.endDate) {
        try {
          bookingResultData = await this.calendarService.checkAvailabilityAndBook(
            analysisResult.startDate,
            analysisResult.endDate,
            `Booking: ${emailData.subject}`,
            'primary',
          );
        } catch (calendarError) {
           this.logger.error(`Calendar check/booking failed for email ${messageId}: ${calendarError.message}`);
           bookingResultData = { available: false, booked: false, message: `Calendar operation failed: ${calendarError.message}`};
        }
      } else {
         bookingResultData = { available: false, booked: false, message: 'Booking not attempted (email not relevant or dates missing).'};
      }

      
      let replyResultData: SendEmailResult | undefined;
      if (analysisResult?.isJapanTourGuideReservation && analysisResult.startDate && analysisResult.endDate) {
          
          const emailDetails = {
              to: emailData.from.email, 
              subject: emailData.subject, 
              startDate: analysisResult.startDate,
              endDate: analysisResult.endDate,
              originalMessageId: `<${getHeader('Message-ID')}>`,
              originalThreadId: emailData.threadId,
          };

           if (!getHeader('Message-ID')) {
               this.logger.warn(`Could not find Message-ID header for email ${messageId}. Replying might not thread correctly.`);            
               emailDetails.originalMessageId = ''; 
           }


          if (bookingResultData?.booked) {
              this.logger.log(`Sending confirmation reply for message ${messageId}`);
              replyResultData = await this.sendGmailService.sendConfirmationEmail(emailDetails);
          } else if (bookingResultData?.available === false && !bookingResultData?.booked) {
              this.logger.log(`Sending availability issue reply for message ${messageId}`);
              replyResultData = await this.sendGmailService.sendAvailabilityIssueEmail(emailDetails);
          } else {
               this.logger.log(`Booking did not succeed for message ${messageId}, but not due to availability. No standard reply sent.`);
               replyResultData = { success: false, message: 'No reply sent due to non-availability booking issue or prior error.' };
          }
      } else {
          this.logger.log(`Email ${messageId} not relevant for booking or missing dates. No reply sent.`);
           replyResultData = { success: false, message: 'No reply sent (email not relevant or dates missing).' };
      }

      await this.markAsRead(messageId);
      this.logger.log(`Marked email ${messageId} as read.`);

      return {
        ...emailData,
        analysis: analysisResult,
        bookingResult: bookingResultData,
        replyResult: replyResultData, 
      };

    } catch (error) {
      this.logger.error(
        `Overall email processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error.stack,
      );
      throw new Error('Failed to process email, analyze, book, or reply. Check server logs.');
    }
  }

  async markAsRead(messageId: string): Promise<void> { 
      if (!this.gmail) { return; }
      try {
          await this.gmail.users.messages.modify({
              userId: 'me',
              id: messageId,
              requestBody: { removeLabelIds: ['UNREAD'] }
          });
          this.logger.log(`Message ${messageId} marked as read.`);
      } catch (error) {
          this.logger.error(`Failed to mark message ${messageId} as read: ${error.message}`);
      }
  }
}