// src/travel-analysis/travel-analysis.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TravelAnalysisService } from './travel-analysis.service';

@Module({
  imports: [ConfigModule],
  providers: [TravelAnalysisService],
  exports: [TravelAnalysisService],
})
export class TravelAnalysisModule {}