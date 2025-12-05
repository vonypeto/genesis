import { Inject, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import pLimit from 'p-limit';
import R from 'ramda';
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
import {
  BrandMetric,
  ByPrompt,
  CostPerToken,
  PromptMetric,
  Row,
} from './libs/types';
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
      Pick<Run['config'], 'concurrencyLimit' | 'retryAttempts' | 'timeout'>
    >;
  }): Promise<{ run: Run | null; isNew: boolean }> {
    const startTime = Date.now();
    // First Idempotency
    if (input.idempotencyKey) {
      const existing = await this.runRepository.findOne({
        idempotencyKey: input.idempotencyKey,
      });
      if (existing) return { run: existing, isNew: false };
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

    const prompts = R.filter(Boolean, promptResults) as Prompt[];
    const brands = R.filter(Boolean, brandResults) as Brand[];

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
        models: R
          ? R.map((m: any) => `${m.provider}:${m.model}`, input.models)
          : input.models.map((m) => `${m.provider}:${m.model}`),
        concurrencyLimit: input.config?.concurrencyLimit ?? 5,
        retryAttempts: input.config?.retryAttempts ?? 3,
        timeout: input.config?.timeout ?? 30000,
      },
    });

    if (!data) {
      throw new Error('Data not found');
    }

    this.logger.log(
      `Run ${data.id} → ${prompts.length} prompts × ${input.models.length} models`
    );

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
            latencies
          );
          totalTokens += tokens;
        })
      )
    );

    await Promise.allSettled(tasks);

    const duration = Date.now() - startTime;
    const avgLatency =
      latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

    const responses = await this.responseRepository.find({ runId: data.id });
    const successCount = responses.filter(
      (r) => r.status === ResponseStatus.SUCCESS
    ).length;
    const failedCount = responses.filter(
      (r) => r.status !== ResponseStatus.SUCCESS
    ).length;
    const avgCost =
      input.models.reduce((sum, data) => {
        return sum + (CostPerToken[data.model] || 0.000001);
      }, 0) / input.models.length;

    await this.runRepository.update(data.id, {
      status:
        failedCount === 0
          ? RunStatus.COMPLETED
          : failedCount < responses.length
          ? RunStatus.PARTIAL
          : RunStatus.FAILED,
      completedPrompts: successCount,
      failedPrompts: failedCount,
      metrics: {
        totalDurationMs: duration,
        avgLatencyMs: Math.round(avgLatency),
        totalTokensUsed: totalTokens,
        estimatedCost: totalTokens * avgCost,
      },
    });
    return { run: data, isNew: true };
  }

  async getRunSummary(runId: string) {
    const run = await this.runRepository.findOne({
      id: runId,
    });
    if (!run) throw new Error('Run not found');

    const objectId = new mongoose.Types.ObjectId(runId);

    const data = await this.brandMentionRepository.aggregate([
      {
        $lookup: {
          from: 'responses',
          localField: 'responseId',
          foreignField: '_id',
          as: 'response',
        },
      },
      { $unwind: '$response' },
      {
        $match: {
          $expr: {
            $or: [
              { $eq: ['$response.runId', objectId] },
              { $eq: [{ $toString: '$response.runId' }, runId] },
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'brands',
          localField: 'brandId',
          foreignField: '_id',
          as: 'brand',
        },
      },
      { $unwind: '$brand' },
      {
        $lookup: {
          from: 'prompts',
          localField: 'response.promptId',
          foreignField: '_id',
          as: 'prompt',
        },
      },
      { $unwind: '$prompt' },
      {
        $group: {
          _id: {
            brandId: '$brandId',
            brandName: '$brand.name',
            promptId: '$response.promptId',
            promptText: '$prompt.text',
            model: '$response.modelName',
          },
          mentioned: { $max: '$mentioned' },
          totalMentions: { $sum: '$mentionCount' },
          avgPosition: { $avg: '$positionIndex' },
        },
      },
      { $sort: { '_id.brandName': 1, '_id.promptText': 1 } },
    ]);

    const rows: Row[] = data.map((item: any) => ({
      brandName: String(item._id.brandName),
      promptText: String(item._id.promptText),
      model: String(item._id.model),
      mentioned: Boolean(item.mentioned),
      totalMentions: Number(item.totalMentions) || 0,
    }));

    const brandGroups: Partial<Record<string, Row[]>> = R.groupBy<Row>(
      (row) => row.brandName,
      rows
    );
    const brandMetrics: BrandMetric[] = Object.entries(
      brandGroups as Record<string, Row[]>
    ).map(([brandName, list]) => {
      const totalMentions = list.reduce((acc, r) => acc + r.totalMentions, 0);
      const groupedByPrompt: Partial<Record<string, Row[]>> = R.groupBy<Row>(
        (row) => row.promptText,
        list
      );
      const byPrompt: ByPrompt[] = Object.entries(
        groupedByPrompt as Record<string, Row[]>
      ).map(([promptText, items]) => {
        const mentionCount = items.reduce(
          (accumulator, row) => accumulator + row.totalMentions,
          0
        );
        const mentioned = items.some((row) => row.mentioned);
        const models = items.map((row) => row.model);
        return { promptText, mentioned, mentionCount, models };
      });
      const mentionCount = byPrompt.reduce(
        (acc, prompt) => acc + (prompt.mentioned ? 1 : 0),
        0
      );
      const mentionRate =
        byPrompt.length > 0 ? mentionCount / byPrompt.length : 0;
      return { brandName, totalMentions, mentionCount, mentionRate, byPrompt };
    });

    const promptGroups: Partial<Record<string, Row[]>> = R.groupBy<Row>(
      (row) => row.promptText,
      rows
    );
    const promptMetrics: PromptMetric[] = Object.entries(
      promptGroups as Record<string, Row[]>
    ).map(([promptText, list]) => {
      const totalResponses = list.length;
      const successfulResponses = list.reduce(
        (accumulator, row) => accumulator + (row.mentioned ? 1 : 0),
        0
      );
      const brandsMetioned = Array.from(
        new Set(list.filter((row) => row.mentioned).map((row) => row.brandName))
      );
      return {
        promptText,
        totalResponses,
        successfulResponses,
        brandsMetioned,
      };
    });

    return { run, brandMetrics, promptMetrics };
  }

  private async processPromptModelPair(
    runId: string,
    prompt: Prompt,
    brands: Brand[],
    modelConfig: { model: string; provider: string },
    maxRetries: number,
    timeout: number,

    latencies: number[]
  ): Promise<number> {
    for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
      try {
        const formattedPrompt = this.formatPrompt(prompt.text, brands);
        // Rate Limit LLM input
        const llmResponse = await this.rateLimiter.scheduleWithDistributedLimit(
          modelConfig.provider,
          () =>
            this.llmProvider.callLLM(formattedPrompt, {
              model: modelConfig.model,
              provider: modelConfig.provider,
              timeout,
              maxRetries,
            })
        );

        latencies.push(llmResponse.latencyMs);
        const response = await this.responseRepository.create({
          runId,
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
        const msg = error?.message ?? '';
        const rateLimited = this.isRateLimitError(msg);
        const status = rateLimited
          ? ResponseStatus.RATE_LIMITED
          : ResponseStatus.FAILED;

        const finalAttempt = retryCount >= maxRetries || rateLimited;
        if (finalAttempt) {
          await this.responseRepository.create({
            runId,
            promptId: prompt.id,
            modelName: modelConfig.model,
            provider: modelConfig.provider,
            latencyMs: 0,
            rawText: '',
            status,
            errorMessage: rateLimited
              ? `Rate limit exceeded: ${msg}`
              : msg || 'Unknown error',
            retryCount,
          });
          this.logger[rateLimited ? 'warn' : 'error'](
            `${status}: ${modelConfig.provider}:${modelConfig.model} – ${msg}`
          );
          return 0;
        }

        const delayMs =
          Math.min(1000 * Math.pow(2, retryCount), 10000) +
          Math.floor(Math.random() * 500);
        this.logger.warn(
          `Retry ${retryCount + 1}/${maxRetries}: ${modelConfig.provider}:${
            modelConfig.model
          } (next in ${delayMs}ms)`
        );
        await new Promise((response) => setTimeout(response, delayMs));
      }
    }

    return 0;
  }

  private async analyzeBrandMentions(
    response: Response,
    brands: Brand[],
    responseText: string
  ): Promise<void> {
    const text = responseText.toLowerCase();

    const mentions = (brand: Brand) => {
      const key = brand.name.toLowerCase();
      const found = text.includes(key);
      const count = found ? (text.match(new RegExp(key, 'g')) || []).length : 0;
      const index = found ? text.indexOf(key) : -1;
      const context = found
        ? responseText.substring(
            Math.max(0, index - 50),
            Math.min(responseText.length, index + key.length + 50)
          )
        : '';
      return {
        responseId: response.id,
        brandId: brand.id,
        mentioned: found,
        positionIndex: found ? index : undefined,
        mentionCount: count,
        context: context || undefined,
      } as Partial<BrandMention> & { responseId: string; brandId: string };
    };

    const mentionsData = R.map(mentions, brands);

    await Promise.all(
      mentionsData.map(
        (
          mention: Partial<BrandMention> & {
            responseId: string;
            brandId: string;
          }
        ) => this.brandMentionRepository.create(mention)
      )
    );
  }

  private generateContentHash(input: CreateRunRequest): string {
    const normalize = (arr: string[]) =>
      R ? R.sortBy(R.identity, arr) : [...arr].sort();
    const content = {
      prompts: normalize(input.prompts),
      brands: normalize(input.brands),
      models: R
        ? R.sortBy((m: any) => `${m.provider}:${m.model}`, input.models)
        : [...input.models].sort((a, b) =>
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

    return `You are an AI assistant evaluating and enhancing brand visibility in responses.

          Brands to reference when relevant:
          ${brandList}

          --- User Question ---
          ${userQuestion}

          --- Instructions ---
          Provide a natural, helpful answer to the user's question.
          When appropriate, recommend or mention specific brands from the list above.
          Do not force a brand mention; only include it when it genuinely fits the context.`;
  }
}
