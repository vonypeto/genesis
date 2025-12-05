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
import { LLMProviderService } from './llm-provider.service';
import { RateLimiterService } from '@genesis/rate-limiter';
import { CreateRunRequest } from 'agent/src/libs/dtos';

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

  async listRuns(
    page: number = 1,
    limit: number = 10
  ): Promise<{ data: Run[]; total: number }> {
    const [data, total] = await Promise.all([
      this.runRepository.findAll(page, limit),
      this.runRepository.countAll(),
    ]);
    return { data, total };
  }

  async createRun(input: {
    prompts: string[];
    brands: string[];
    models: Array<{ provider: string; model: string }>;
    notes?: string;
    idempotencyKey?: string;
    config?: Partial<
      Pick<
        Run['config'],
        | 'concurrencyLimit'
        | 'retryAttempts'
        | 'timeout'
        | 'rateLimitPerSecond'
        | 'enableCircuitBreaker'
      >
    >;
  }): Promise<{ run: Run | null; isNew: boolean }> {
    if (input.idempotencyKey) {
      const data = await this.runRepository.findOne({
        idempotencyKey: input.idempotencyKey,
      });

      return { run: data, isNew: false };
    }

    const [prompts, brands] = await Promise.all([
      Promise.all(
        input.prompts.map((text: string) =>
          this.promptRepository.update(text, { text }, { upsert: true })
        )
      ),
      Promise.all(
        input.brands.map((name: string) =>
          this.brandRepository.update(name, { name }, { upsert: true })
        )
      ),
    ]);

    const data = await this.runRepository.create({
      notes: input.notes,
      status: RunStatus.PENDING,
      totalPrompts: prompts.length * input.models.length,
      completedPrompts: 0,
      failedPrompts: 0,
      idempotencyKey: input.idempotencyKey,
      contentHash: this.generateContentHash(input),
      config: {
        brands: input.brands,
        models: input.models.map(
          (model: Record<string, unknown>) =>
            `${model['provider']}:${model['model']}`
        ),
        concurrencyLimit: input.config?.concurrencyLimit || 5,
        retryAttempts: input.config?.retryAttempts || 3,
        timeout: input.config?.timeout || 30000,
        rateLimitPerSecond: input.config?.rateLimitPerSecond,
        enableCircuitBreaker: input.config?.enableCircuitBreaker !== false,
      },
    });

    if (!data) {
      throw new Error('Data not found');
    }

    const startTime = Date.now();

    this.logger.log(
      `Starting run ${data.id}: ${prompts.length} prompts × ${input.models.length} models`
    );

    await this.runRepository.update(data.id, { status: RunStatus.PENDING });

    const limit = pLimit(data.config.concurrencyLimit || 5);
    const latencies: number[] = [];
    let totalTokens = 0;

    // const tasks = prompts.flatMap((prompt) =>
    //   input.models.map((model) =>
    //     limit(async () => {
    //       const tokens = await this.processPromptModelPair(
    //         data.id,
    //         prompt,
    //         brands,
    //         model,
    //         data.config.retryAttempts || 3,
    //         data.config.timeout || 30000,
    //         data.config.enableCircuitBreaker !== false,
    //         latencies
    //       );
    //       totalTokens += tokens;
    //     })
    //   )
    // );

    // await Promise.allSettled(tasks);

    return { run: null, isNew: true };
  }

  // private async processPromptModelPair(
  //   runId: string,
  //   prompt: Prompt,
  //   brands: Brand,
  //   modelConfig: { model: string; provider: string },
  //   maxRetries: number,
  //   timeout: number,
  //   useCircuitBreaker: boolean,
  //   latencies: number[]
  // ): Promise<number> {
  //   let retryCount = 0;

  //   while (retryCount <= maxRetries) {
  //     try {
  //       const llmResponse = await this.rateLimiter.scheduleWithDistributedLimit(
  //         modelConfig.provider,
  //         () =>
  //           this.llmProvider.callLLM(prompt.text, {
  //             model: modelConfig.model,
  //             provider: modelConfig.provider,
  //             timeout,
  //             useCircuitBreaker,
  //           })
  //       );

  //       latencies.push(llmResponse.latencyMs);
  //       const response = await this.saveResponse(
  //         runId,
  //         prompt,
  //         modelConfig,
  //         llmResponse,
  //         retryCount
  //       );
  //       await this.analyzeBrandMentions(response, brands, llmResponse.text);

  //       return llmResponse.tokenUsage?.totalTokens || 0;
  //     } catch (error) {
  //       const errorMsg = (error as Error)?.message || '';
  //       const isRateLimit = this.isRateLimitError(errorMsg);

  //       if (isRateLimit || retryCount >= maxRetries) {
  //         await this.saveFailedResponse(
  //           runId,
  //           prompt,
  //           modelConfig,
  //           error as Error,
  //           retryCount,
  //           isRateLimit
  //         );
  //         return 0;
  //       }

  //       retryCount++;
  //       await this.delayWithBackoff(retryCount);
  //       this.logger.warn(
  //         `Retry ${retryCount}/${maxRetries}: ${modelConfig.provider}:${modelConfig.model}`
  //       );
  //     }
  //   }

  //   return 0;
  // }

  private generateContentHash(input: CreateRunRequest): string {
    const content = {
      prompts: [...input.prompts].sort(),
      brands: [...input.brands].sort(),
      models: [...input.models].sort((a, b) =>
        `${a.provider}:${a.model}`.localeCompare(`${b.provider}:${b.model}`)
      ),
    };
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(content))
      .digest('hex');
  }
}
