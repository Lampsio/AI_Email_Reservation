import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGroq } from '@langchain/groq';
import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';

const analysisSchema = z.object({
  isJapanTourGuideReservation: z
    .boolean()
    .describe(
      'True if the email content indicates a reservation for a tour guide in Japan, false otherwise.',
    ),
  startDate: z
    .string()
    .nullable()
    .describe(
      'The start date of the reservation in YYYY-MM-DD format. Null if not a Japan tour guide reservation or if the date is not found.',
    ),
  endDate: z
    .string()
    .nullable()
    .describe(
      'The end date of the reservation in YYYY-MM-DD format. Null if not a Japan tour guide reservation or if the date is not found.',
    ),
  reasoning: z
    .string()
    .optional()
    .describe('A brief explanation for the classification and date extraction.'),
});

export type JapanTourAnalysis = z.infer<typeof analysisSchema>;

@Injectable()
export class TravelAnalysisService implements OnModuleInit {
  private readonly logger = new Logger(TravelAnalysisService.name);
  private llm: ChatGroq;
  private parser: StructuredOutputParser<typeof analysisSchema>;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const groqApiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!groqApiKey) {
      this.logger.error('GROQ_API_KEY is not configured.');
      throw new Error('GROQ_API_KEY is missing in environment variables.');
    }

    this.llm = new ChatGroq({
      apiKey: groqApiKey,
      model: 'llama3-8b-8192', 
      temperature: 0.1, 
    });

    this.parser = StructuredOutputParser.fromZodSchema(analysisSchema);
    this.logger.log('TravelAnalysisService initialized with Groq and Zod parser.');
  }

  async analyzeEmailForJapanTour(
    emailBody: string,
  ): Promise<JapanTourAnalysis> {
    if (!emailBody || emailBody.trim() === '') {
      this.logger.warn('Received empty email body for analysis.');
      return {
        isJapanTourGuideReservation: false,
        startDate: null,
        endDate: null,
        reasoning: 'Email body was empty.',
      };
    }

    const formatInstructions = this.parser.getFormatInstructions();

    const promptTemplate = PromptTemplate.fromTemplate(
`Analyze the following email body to determine if it concerns a reservation for a tour guide in Japan.

{format_instructions}

Based on the email content, identify:
1. If it is a reservation for a tour guide in Japan.
2. If it is, try to extract the start date and end date of the reservation. Dates should be in YYYY-MM-DD format.
   If a date is not found or not applicable, use null for that field.
   If the email is NOT about a Japan tour guide reservation, both startDate and endDate should be null.
3. Provide a brief reasoning for your conclusion.

Email Body:
---
{email_body}
---

Respond with your analysis based on the format instructions. If dates are mentioned in various formats, please convert them to YYYY-MM-DD.
If the email is very clearly not related to any travel or reservation, set isJapanTourGuideReservation to false and dates to null.
Example for relevant email: "Booking confirmation for your Tokyo guide, Kenji, from 2024-09-15 to 2024-09-18."
Example for irrelevant email: "Newsletter about our latest products."
`
    );

    const chain = promptTemplate.pipe(this.llm).pipe(this.parser);

    this.logger.log('Analyzing email body for Japan tour guide reservation...');
    try {
      const result = await chain.invoke({
        email_body: emailBody.substring(0, 7000), 
        format_instructions: formatInstructions,
      });
      this.logger.log('Analysis complete:', result);
      return result;
    } catch (error) {
      this.logger.error(
        `Error during email analysis with Langchain/Groq: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to analyze email content.');
    }
  }
}