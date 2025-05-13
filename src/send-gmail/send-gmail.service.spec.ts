import { Test, TestingModule } from '@nestjs/testing';
import { SendGmailService } from './send-gmail.service';

describe('SendGmailService', () => {
  let service: SendGmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SendGmailService],
    }).compile();

    service = module.get<SendGmailService>(SendGmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
