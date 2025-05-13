import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import MailComposer = require('nodemailer/lib/mail-composer');

export interface SendEmailResult {
  success: boolean;
  message: string;
  messageId?: string | null; 
}

interface EmailDetails {
  to: string;
  subject: string;
  startDate: string;
  endDate: string;
  originalMessageId: string; 
  originalThreadId: string; 
}

@Injectable()
export class SendGmailService implements OnModuleInit {
  private readonly logger = new Logger(SendGmailService.name);
  private gmail: gmail_v1.Gmail;
  private oAuth2Client: OAuth2Client;
  private userEmail: string = 'me'; 

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initializeGmailClient();
    this.fetchUserEmail();
  }

  private initializeGmailClient() {
    const clientId = this.configService.get<string>('GMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GMAIL_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('GMAIL_REFRESH_TOKEN');

    if (!clientId || !clientSecret || !refreshToken) {
      this.logger.error(
        'Missing Google API credentials (Client ID, Secret, Refresh Token) in .env file',
      );
      throw new Error('Missing Google API credentials');
    }
    this.logger.warn(
      'Ensure the GMAIL_REFRESH_TOKEN was obtained with Gmail ',
    );

    this.oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);

    this.oAuth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    this.gmail = google.gmail({
      version: 'v1',
      auth: this.oAuth2Client,
    });

    this.logger.log('Gmail client (for sending) initialized.');
  }

  private async fetchUserEmail() {
     if (this.userEmail !== 'me') return;
     try {
        const profile = await this.gmail.users.getProfile({ userId: 'me', fields: 'emailAddress'});
        if (profile.data.emailAddress) {
            this.userEmail = profile.data.emailAddress;
            this.logger.log(`Authenticated as ${this.userEmail}`);
        } else {
            this.logger.warn("Could not fetch user's email address, using 'me'.");
            this.userEmail = 'me'; 
        }
     } catch (error) {
        this.logger.error(`Failed to fetch user email address: ${error.message}`);
        this.userEmail = 'me'; 
     }
  }

  private async sendRawEmail(
    rawMessage: string,
    threadId: string,
  ): Promise<SendEmailResult> {
    if (!this.gmail) {
      this.logger.error('Gmail client (for sending) not initialized.');
      return { success: false, message: 'Gmail client not ready.' };
    }
    try {
      const encodedMessage = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId: threadId, 
        },
      });

      this.logger.log(`Reply email sent successfully. Message ID: ${res.data.id}, Thread ID: ${res.data.threadId}`);
      return {
        success: true,
        message: 'Reply email sent successfully.',
        messageId: res.data.id,
      };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
       if (error.response?.data?.error) {
        const apiError = error.response.data.error;
        this.logger.error(`Google API Error: ${apiError.code} ${apiError.message}`);
         if(apiError.code === 403) {
            return { success:false, message: `Permission denied. Check Gmail SENDING scopes. Details: ${apiError.message}` };
         }
         return { success:false, message: `Google API Error: ${apiError.message}` };
      }
      return { success: false, message: `Failed to send email: ${error.message}` };
    }
  }

  async sendConfirmationEmail(details: EmailDetails): Promise<SendEmailResult> {
    this.logger.log(`Preparing confirmation email to ${details.to} for booking ${details.startDate} - ${details.endDate}`);

    const subject = `Re: ${details.subject}`; 
    const body = `
Hello,

This email confirms your tour guide reservation in Japan has been successfully booked for the following dates:

Start Date: ${details.startDate}
End Date: ${details.endDate}

The booking has been added to the calendar.

Regards,
Your Automated Booking System
    `; 

    const mailOptions = {
      to: details.to,
      from: this.userEmail, 
      subject: subject,
      text: body,
      replyTo: this.userEmail, 
      inReplyTo: details.originalMessageId, 
      references: details.originalMessageId, 
      
    };

    const mailComposer = new MailComposer(mailOptions);
    const rawMessage = await mailComposer.compile().build(); 

    return this.sendRawEmail(rawMessage.toString(), details.originalThreadId);
  }

  
  async sendAvailabilityIssueEmail(details: EmailDetails): Promise<SendEmailResult> {
     this.logger.log(`Preparing availability issue email to ${details.to} for requested dates ${details.startDate} - ${details.endDate}`);

    const subject = `Re: ${details.subject}`;
    const body = `
Hello,

Regarding your request for a tour guide reservation in Japan for the dates ${details.startDate} to ${details.endDate}.

Unfortunately, the requested period is currently unavailable in the calendar.

Could you please provide alternative dates that might work for you?

Regards,
Your Automated Booking System
    `;

     const mailOptions = {
      to: details.to,
      from: this.userEmail,
      subject: subject,
      text: body,
      replyTo: this.userEmail,
      inReplyTo: details.originalMessageId,
      references: details.originalMessageId,
    };

    const mailComposer = new MailComposer(mailOptions);
    const rawMessage = await mailComposer.compile().build();

    return this.sendRawEmail(rawMessage.toString(), details.originalThreadId);
  }
}