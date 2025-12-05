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
import mongoose from 'mongoose';

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
      if (data) return { run: data, isNew: false };
    }

    const [promptResults, brandResults] = await Promise.all([
      Promise.all(
        input.prompts.map((text: string) =>
          this.promptRepository.updateOne(
            { text },
            { $set: { text } },
            { upsert: true, setDefaultsOnInsert: true }
          )
        )
      ),
      Promise.all(
        input.brands.map((name: string) =>
          this.brandRepository.updateOne(
            { name },
            { $set: { name } },
            { upsert: true, setDefaultsOnInsert: true }
          )
        )
      ),
    ]);

    const prompts = promptResults.filter((p): p is Prompt => p !== null);
    const brands = brandResults.filter((b): b is Brand => b !== null);

    if (prompts.length === 0) {
      throw new Error('Failed to create or retrieve prompts');
    }

    if (brands.length === 0) {
      throw new Error('Failed to create or retrieve brands');
    }

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

    const tasks = prompts.flatMap((prompt) =>
      input.models.map((model) =>
        limit(async () => {
          const tokens = await this.processPromptModelPair(
            data.id,
            prompt,
            brands,
            model,
            data.config.retryAttempts || 3,
            data.config.timeout || 30000,
            data.config.enableCircuitBreaker !== false,
            latencies
          );
          totalTokens += tokens;
        })
      )
    );

    await Promise.allSettled(tasks);

    return { run: null, isNew: true };
  }

  private async processPromptModelPair(
    runId: string,
    prompt: Prompt,
    brands: Brand[],
    modelConfig: { model: string; provider: string },
    maxRetries: number,
    timeout: number,
    useCircuitBreaker: boolean,
    latencies: number[]
  ): Promise<number> {
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        const formattedPrompt = this.formatPrompt(prompt.text, brands);

        const llmResponse = await this.rateLimiter.scheduleWithDistributedLimit(
          modelConfig.provider,
          () =>
            this.llmProvider.callLLM(formattedPrompt, {
              model: modelConfig.model,
              provider: modelConfig.provider,
              timeout,
              useCircuitBreaker,
            })
        );

        latencies.push(llmResponse.latencyMs);

        const response = await this.responseRepository.create({
          runId: runId,
          promptId: prompt.id,
          modelName: modelConfig.model,
          provider: modelConfig.provider,
          latencyMs: llmResponse.latencyMs,
          rawText: llmResponse.text,
          tokenUsage: llmResponse.tokenUsage,
          metadata: llmResponse.metadata,
          status: ResponseStatus.SUCCESS,
          retryCount,
        });

        await this.analyzeBrandMentions(response, brands, llmResponse.text);

        return llmResponse.tokenUsage?.totalTokens || 0;
      } catch (error: any) {
        const errorMsg = error?.message || '';
        const isRateLimit = this.isRateLimitError(errorMsg);
        const status = isRateLimit
          ? ResponseStatus.RATE_LIMITED
          : ResponseStatus.FAILED;

        if (isRateLimit || retryCount >= maxRetries) {
          const errorMessage = await this.responseRepository.create({
            runId: runId,
            promptId: prompt.id,
            modelName: modelConfig.model,
            provider: modelConfig.provider,
            latencyMs: 0,
            rawText: '',
            status,
            errorMessage: isRateLimit
              ? `Rate limit exceeded: ${error.message}`
              : error.message || 'Unknown error',
            retryCount,
          });

          const logMethod = isRateLimit ? 'warn' : 'error';
          this.logger[logMethod](
            `${status}: ${modelConfig.provider}:${modelConfig.model} - ${errorMessage}`
          );
          return 0;
        }

        retryCount++;

        const baseDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
        const jitter = Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));

        this.logger.warn(
          `Retry ${retryCount}/${maxRetries}: ${modelConfig.provider}:${modelConfig.model}`
        );
      }
    }

    return 0;
  }

  private async analyzeBrandMentions(
    response: Response,
    brands: Brand[],
    responseText: string
  ): Promise<void> {
    const lowerText = responseText.toLowerCase();

    const mentions = brands.map((brand) => {
      const brandLower = brand.name.toLowerCase();
      const mentioned = lowerText.includes(brandLower);

      if (!mentioned) {
        return {
          responseId: response.id,
          brandId: brand.id,
          mentioned: false,
          positionIndex: undefined,
          mentionCount: 0,
          context: undefined,
        };
      }

      const mentionCount = (lowerText.match(new RegExp(brandLower, 'g')) || [])
        .length;
      const positionIndex = lowerText.indexOf(brandLower);

      const start = Math.max(0, positionIndex - 50);
      const end = Math.min(
        responseText.length,
        positionIndex + brandLower.length + 50
      );
      const context = responseText.substring(start, end);

      return {
        responseId: response.id,
        brandId: brand.id,
        mentioned: true,
        positionIndex,
        mentionCount,
        context,
      };
    });

    await Promise.all(
      mentions.map((m) => this.brandMentionRepository.create(m as any))
    );
  }

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

  private isRateLimitError(errorMsg: string): boolean {
    return (
      errorMsg.includes('Rate limit') ||
      errorMsg.includes('rate limit') ||
      errorMsg.includes('429') ||
      errorMsg.includes('Too Many Requests')
    );
  }

  private formatPrompt(userQuestion: string, brands: Brand[]): string {
    const brandList = brands.map((b) => `- ${b.name}`).join('\n');

    return `You are evaluating brand visibility in AI assistant responses.

    Brands to consider:
    ${brandList}

    ---- Question ----

    ${userQuestion}

    ---- Instructions ----

    Please provide a natural, helpful response to the user's question. When relevant, mention specific brands or products that would be good recommendations.`;
  }
}
