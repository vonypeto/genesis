import { Module } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { LLMAgentService } from './llm-agent.service';
import { LLMProviderService } from './llm-provider.service';
import { Tokens } from './libs/tokens';
import { RunRepositoryFactory } from './repositories/run.repository';
import { PromptRepositoryFactory } from './repositories/prompt.repository';
import { BrandRepositoryFactory } from './repositories/brand.repository';
import { ResponseRepositoryFactory } from './repositories/response.repository';
import { BrandMentionRepositoryFactory } from './repositories/brand-mention.repository';
import { CircuitBreakerService } from '@genesis/circuit-breaker';
import { RateLimiterService } from '@genesis/rate-limiter';
import { RedisService } from '@genesis/redis';

@Module({
  imports: [],
  controllers: [],
  providers: [
    {
      provide: Tokens.RunRepository,
      useFactory: RunRepositoryFactory,
      inject: [getConnectionToken()],
    },
    {
      provide: Tokens.PromptRepository,
      useFactory: PromptRepositoryFactory,
      inject: [getConnectionToken()],
    },
    {
      provide: Tokens.BrandRepository,
      useFactory: BrandRepositoryFactory,
      inject: [getConnectionToken()],
    },
    {
      provide: Tokens.ResponseRepository,
      useFactory: ResponseRepositoryFactory,
      inject: [getConnectionToken()],
    },
    {
      provide: Tokens.BrandMentionRepository,
      useFactory: BrandMentionRepositoryFactory,
      inject: [getConnectionToken()],
    },
    RedisService,
    CircuitBreakerService,
    RateLimiterService,
    LLMProviderService,
    LLMAgentService,
  ],
  exports: [LLMAgentService],
})
export class LLMAgentModule {}
