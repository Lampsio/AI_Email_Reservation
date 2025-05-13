import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface CalendarBookingResult {
  available: boolean;
  booked: boolean;
  message: string;
  eventId?: string | null; 
}

@Injectable()
export class CalendarService implements OnModuleInit {
  private readonly logger = new Logger(CalendarService.name);
  private calendar: calendar_v3.Calendar;
  private oAuth2Client: OAuth2Client;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initializeCalendarClient();
  }

  private initializeCalendarClient() {
    const clientId = this.configService.get<string>('GMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GMAIL_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('GMAIL_REFRESH_TOKEN');
    const redirectUri = this.configService.get<string>('GMAIL_REDIRECT_URI'); 

    if (!clientId || !clientSecret || !refreshToken) {
      this.logger.error(
        'Missing Google API credentials (Client ID, Secret, Refresh Token) in .env file',
      );
      throw new Error('Missing Google API credentials');
    }
    this.logger.warn(
      'Ensure the GMAIL_REFRESH_TOKEN was obtained with Google Calendar scopes',
    );

    this.oAuth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri, 
    );

    this.oAuth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    this.calendar = google.calendar({
      version: 'v3',
      auth: this.oAuth2Client,
    });

    this.logger.log('Google Calendar client initialized.');
  }

  /**
   * @param startDate - Start date in YYYY-MM-DD format.
   * @param endDate - End date in YYYY-MM-DD format.
   * @param eventTitle - Title for the calendar event.
   * @param calendarId - ID of the calendar to check/book (default: 'primary').
   * @returns Promise<CalendarBookingResult>
   */
  async checkAvailabilityAndBook(
    startDate: string,
    endDate: string,
    eventTitle: string,
    calendarId: string = 'primary',
  ): Promise<CalendarBookingResult> {
    if (!this.calendar) {
      this.logger.error('Calendar client not initialized.');
      throw new Error('Calendar client not ready');
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        this.logger.error(`Invalid date format provided: Start=[${startDate}], End=[${endDate}]`);
        return { available: false, booked: false, message: 'Invalid date format. Use YYYY-MM-DD.' };
    }

    const timeMin = `${startDate}T00:00:00Z`; 
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const timeMax = `${endDateObj.toISOString().split('T')[0]}T00:00:00Z`; 

    this.logger.log(
      `Checking calendar '${calendarId}' availability from ${timeMin} to ${timeMax}`,
    );

    try {
      const freeBusyResponse = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: timeMin,
          timeMax: timeMax,
          items: [{ id: calendarId }],
          timeZone: 'UTC', 
        },
      });

      const busySlots = freeBusyResponse.data.calendars?.[calendarId]?.busy;

      if (busySlots && busySlots.length > 0) {
        this.logger.log(
          `Calendar '${calendarId}' is busy during the requested period. Busy slots: ${JSON.stringify(busySlots)}`,
        );
        return {
          available: false,
          booked: false,
          message: `Slot from ${startDate} to ${endDate} is not available.`,
        };
      }

      this.logger.log(`Slot from ${startDate} to ${endDate} is available.`);

      const eventEndDate = `${endDateObj.toISOString().split('T')[0]}`; 

      const event: calendar_v3.Schema$Event = {
        summary: eventTitle,
        description: `Booked based on email analysis. Original period: ${startDate} to ${endDate}`,
        start: {
          date: startDate, 
        },
        end: {
          date: eventEndDate, 
        },
      };

      this.logger.log(`Attempting to book event: ${eventTitle} from ${startDate} to ${endDate}`);
      const createdEvent = await this.calendar.events.insert({
        calendarId: calendarId,
        requestBody: event,
      });

      this.logger.log(`Event created successfully. Event ID: ${createdEvent.data.id}`);
      return {
        available: true,
        booked: true,
        message: `Event '${eventTitle}' booked successfully from ${startDate} to ${endDate}.`,
        eventId: createdEvent.data.id,
      };

    } catch (error) {
      this.logger.error(
        `Failed to check availability or book event: ${error.message}`,
        error.stack,
      );
      if (error.response?.data?.error) {
        const apiError = error.response.data.error;
        this.logger.error(`Google API Error: ${apiError.code} ${apiError.message}`);
         if(apiError.code === 403) {
            return { available:false, booked: false, message: `Permission denied. Check Calendar API access and OAuth scopes. Details: ${apiError.message}` };
         }
          return { available:false, booked: false, message: `Google API Error: ${apiError.message}` };
      }
      return {
        available: false, 
        booked: false,
        message: `An error occurred: ${error.message}`,
      };
    }
  }
}