import { Test, TestingModule } from '@nestjs/testing';
import { TravelAnalysisService } from './travel-analysis.service';

describe('TravelAnalysisService', () => {
  let service: TravelAnalysisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TravelAnalysisService],
    }).compile();

    service = module.get<TravelAnalysisService>(TravelAnalysisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
