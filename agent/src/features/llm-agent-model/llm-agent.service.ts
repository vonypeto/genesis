import { Inject, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import pLimit from 'p-limit';
import { Tokens } from './libs/tokens';
import { Run, RunRepository, RunStatus } from './repositories/run.repository';
import { Prompt, PromptRepository } from './repositories/prompt.repository';
import { Brand, BrandRepository } from './repositories/brand.repository';
import {
  Response,
  ResponseRepository,
  ResponseStatus,
} from './repositories/response.repository';
import {
  BrandMention,
  BrandMentionRepository,
} from './repositories/brand-mention.repository';
import {
  CreateRunRequest,
  RunSummaryResponse,
  RunChatResponse,
  LLMResponse,
} from '../../libs/dtos';
import { LLMProviderService } from './llm-provider.service';
import { RateLimiterService } from '@genesis/rate-limiter';

@Injectable()
export class LLMAgentService {
  private readonly logger = new Logger(LLMAgentService.name);

  constructor(
    @Inject(Tokens.RunRepository)
    private readonly runRepository: RunRepository,
    @Inject(Tokens.PromptRepository)
    private readonly promptRepository: PromptRepository,
    @Inject(Tokens.BrandRepository)
    private readonly brandRepository: BrandRepository,
    @Inject(Tokens.ResponseRepository)
    private readonly responseRepository: ResponseRepository,
    @Inject(Tokens.BrandMentionRepository)
    private readonly brandMentionRepository: BrandMentionRepository,
    private readonly llmProvider: LLMProviderService,
    private readonly rateLimiter: RateLimiterService
  ) {
    this.rateLimiter.createProviderLimiters();
  }

  async createRun(_input: CreateRunRequest) {
    return { isNew: true };
  }
}
