import { Inject, Injectable, Logger } from '@nestjs/common';
import { Tokens } from './libs/tokens';

import { RunsRepository } from './repositories/run.repository';
import { PromptsRepository, Prompt } from './repositories/prompt.repository';
import { BrandsRepository, Brand } from './repositories/brand.repository';
import {
  ResponsesRepository,
  Response,
} from './repositories/response.repository';
import { MentionsRepository } from './repositories/mention.repository';
import { ObjectId } from '@genesis/object-id';
import R from 'ramda';
import { LLMModel, LLMProvider, RunStatus } from './libs/types';
import { LLMProviderService } from './llm-provider.service';

type StartRunInput = {
  prompts: string[];
  brands: string[];
  models: string[];
  notes?: string;
};

interface BrandMetrics {
  brandMentions: Record<string, number>;
  mentionRate?: Record<string, number>;
  visibilityScore?: Record<string, number>;
  ranking?: string[];
  summary?: string;
}

interface PromptSummary {
  prompt: string;
  model: string;
  answer: string;
  brandMetrics: BrandMetrics;
}

@Injectable()
export class LLMAgentService {
  private readonly logger = new Logger(LLMAgentService.name);

  constructor(
    @Inject(Tokens.RunsRepository)
    private readonly runs: RunsRepository,
    @Inject(Tokens.PromptsRepository)
    private readonly promptsRepo: PromptsRepository,
    @Inject(Tokens.BrandsRepository)
    private readonly brandsRepo: BrandsRepository,
    @Inject(Tokens.ResponsesRepository)
    private readonly responsesRepo: ResponsesRepository,
    @Inject(Tokens.MentionsRepository)
    private readonly mentionsRepo: MentionsRepository,
    private readonly llmProvider: LLMProviderService
  ) {}

  async startRun(input: StartRunInput): Promise<{ runId: string }> {
    const runId = ObjectId.generate();

    const run = await this.runs.create({
      id: runId,
      notes: input.notes,
      totalPrompts: 0,
      failedPrompts: 0,
      status: RunStatus.PENDING,
    });

    await this.runs.updateOne(
      { id: run.id },
      { $set: { status: RunStatus.RUNNING } }
    );

    const promptEntities = await Promise.all(
      input.prompts.map(
        async (promptText: string) =>
          await this.promptsRepo.updateOne(
            { text: promptText, runId: run.id },
            { $set: { text: promptText, runId: run.id } },
            { upsert: true }
          )
      )
    );

    const brandEntities = await Promise.all(
      input.brands.map(
        async (brandName: string) =>
          await this.brandsRepo.updateOne(
            { name: brandName, runId: run.id },
            { $set: { name: brandName, runId: run.id } },
            { upsert: true }
          )
      )
    );

    let totalPrompts = 0;
    let failedPrompts = 0;

    for (const promptEntity of promptEntities) {
      for (const modelString of input.models) {
        const idx = modelString.indexOf(':');
        const provider = (
          idx === -1 ? modelString : modelString.slice(0, idx)
        ) as LLMProvider;
        const modelName = (
          idx === -1 ? modelString : modelString.slice(idx + 1)
        ) as LLMModel;
        const formattedPrompt = this.buildFormattedPrompt(
          promptEntity.text,
          input.brands
        );

        try {
          const result = await this.llmProvider.callLLM(formattedPrompt, {
            provider,
            model: modelName,
            timeout: 30000,
          });

          const rawText = result.text ?? '';
          const latencyMs = result.latencyMs ?? 0;
          let meta: BrandMetrics | undefined;
          const match = rawText.match(/\{[\s\S]*\}$/);
          if (!match) {
            meta = undefined;
          } else {
            try {
              meta = JSON.parse(match[0]) as BrandMetrics;
            } catch (error) {
              this.logger.error(
                'Failed to parse LLM JSON',
                error instanceof Error ? error.stack : String(error)
              );
              meta = { brandMentions: {}, summary: 'Failed to parse LLM JSON' };
            }
          }

          const responseEntity = await this.responsesRepo.create({
            runId: run.id,
            promptId: promptEntity.id,
            model: modelString,
            latencyMs,
            rawText,
            meta,
          });

          await this.recordMentions(responseEntity, brandEntities);
          totalPrompts++;
          this.logger.log(
            `LLM response received for model: ${modelString} runId: ${run.id}`
          );
        } catch (error) {
          failedPrompts++;
          this.logger.error(
            `Error calling LLM for model ${modelString}: ${
              error instanceof Error ? error.stack : error
            }`
          );
        }
      }
    }

    await this.runs.updateOne(
      { id: run.id },
      { $set: { totalPrompts, failedPrompts, status: RunStatus.COMPLETED } }
    );
    return { runId: run.id.toString('hex') };
  }
  public async getRunStatus(runId: string): Promise<{ status: string }> {
    const run = await this.runs.findOne({ id: runId });
    if (!run) {
      return { status: 'not_found' };
    }
    return { status: run.status };
  }
  private async recordMentions(response: Response, brands: Brand[]) {
    const text = R.toLower(response.rawText);
    await Promise.all(
      R.map(async (brand: Brand) => {
        const brandNameLower = R.toLower(brand.name);
        const found = R.includes(brandNameLower, text);
        const positionIndex = found
          ? R.indexOf(brandNameLower, text)
          : undefined;
        await this.mentionsRepo.create({
          responseId: response.id,
          brandId: brand.id,
          mentioned: found,
          positionIndex,
        });
      }, brands)
    );
  }

  async getRunSummary(runId: string): Promise<{ prompts: PromptSummary[] }> {
    const [responses, brands] = await Promise.all([
      this.responsesRepo.find({ runId }),
      this.brandsRepo.find({ runId }),
    ]);

    const configuredBrands = R.map(R.prop('name'), brands);
    const summaries: PromptSummary[] = [];

    // Helper: find best matching key for each configured brand

    await Promise.all(
      R.map(async (response: Response) => {
        const prompt = await this.promptsRepo.findOne({
          id: response.promptId,
        });
        let brandMetrics = response.meta as BrandMetrics | undefined;

        // If no metrics, compute mentions by regex
        if (!brandMetrics) {
          const normalizedText = R.toLower(
            R.replace(
              /\s{2,}/g,
              ' ',
              R.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ', response.rawText)
            )
          );
          const brandMentions = R.reduce(
            (acc, brand) => {
              const regex = new RegExp(`\\b${R.toLower(brand)}\\b`, 'g');
              acc[brand] = (R.match(regex, normalizedText) || []).length;
              return acc;
            },
            {},
            configuredBrands
          );
          brandMetrics = { brandMentions };
        }

        brandMetrics = {
          ...brandMetrics,
          brandMentions: R.reduce(
            (acc, brand) => {
              acc[brand] = this.findBestMatch(
                brandMetrics.brandMentions,
                brand
              );
              return acc;
            },
            {},
            configuredBrands
          ),
          mentionRate: R.reduce(
            (acc, brand) => {
              acc[brand] = this.findBestMatch(brandMetrics.mentionRate, brand);
              return acc;
            },
            {},
            configuredBrands
          ),
          visibilityScore: R.reduce(
            (acc, brand) => {
              acc[brand] = this.findBestMatch(
                brandMetrics.visibilityScore,
                brand
              );
              return acc;
            },
            {},
            configuredBrands
          ),
          ranking: Array.isArray(brandMetrics.ranking)
            ? R.filter(
                (name: string) =>
                  R.any(
                    (b: string) => R.toLower(name).includes(R.toLower(b)),
                    configuredBrands
                  ),
                brandMetrics.ranking
              )
            : [],
        };

        summaries.push({
          prompt: prompt?.text ?? 'unknown prompt',
          model: response.model,
          answer: response.rawText,
          brandMetrics,
        });
      }, responses)
    );

    return { prompts: summaries };
  }

  private buildFormattedPrompt(promptText: string, brands: string[]): string {
    return `
      You are an AI assistant analyzing brand visibility.

      Task:
      - Answer the user's question while emphasizing all brands provided.
      - Mention each brand multiple times and compare them throughout the response.

      Question:
      ${promptText}

      Instructions:
      - Highlight each brand’s strengths, weaknesses, features, and best use cases.
      - Provide specific comparisons and recommendations.
      - Rank the brands and justify the ranking.
      - Use the brands naturally but frequently.

      Output:
      1. Full answer text.
      2. JSON object on a new line with structure:
      {
        "brandMentions": { "BrandA": <count>, ... },
        "mentionRate": { "BrandA": <rate>, ... },
        "visibilityScore": { "BrandA": <score>, ... },
        "ranking": ["BrandA", "BrandB", ...],
        "summary": "Short summary of brand visibility."
      }
      Return only the JSON object, no markdown.
      `;
  }

  private findBestMatch = (
    object: Record<string, number> | undefined,
    brand: string
  ): number => {
    if (!object) return 0;
    const brandLower = R.toLower(brand);
    const keys = R.keys(object);
    const exact = R.find((key) => R.toLower(key) === brandLower, keys);

    if (exact) return object[exact];

    const partial = R.find(
      (key) =>
        R.toLower(key).includes(brandLower) ||
        brandLower.includes(R.toLower(key)),
      keys
    );

    if (partial) return object[partial];

    return 0;
  };
}
