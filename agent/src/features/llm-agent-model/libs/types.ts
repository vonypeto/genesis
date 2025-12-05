export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
}

export const CostPerToken: Record<string, number> = {
  'gpt-4o-mini': 0.00000015,
  'gpt-4o': 0.000005,
  'gpt-3.5-turbo': 0.0000005,
  'claude-3-5-sonnet-20241022': 0.000003,
  'claude-3-5-haiku-20241022': 0.0000008,
};

// Strict types for transformation
export type Row = {
  brandName: string;
  promptText: string;
  model: string;
  mentioned: boolean;
  totalMentions: number;
};
export type ByPrompt = {
  promptText: string;
  mentioned: boolean;
  mentionCount: number;
  models: string[];
};
export type BrandMetric = {
  brandName: string;
  totalMentions: number;
  mentionCount: number;
  mentionRate: number;
  byPrompt: ByPrompt[];
};
export type PromptMetric = {
  promptText: string;
  totalResponses: number;
  successfulResponses: number;
  brandsMetioned: string[];
};
