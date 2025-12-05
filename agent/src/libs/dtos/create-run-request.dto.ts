export interface CreateRunRequest {
  prompts: string[];
  brands: string[];
  models: { model: string; provider: string }[];
  notes?: string;
  idempotencyKey?: string;
  config?: {
    concurrencyLimit?: number;
    retryAttempts?: number;
    timeout?: number;
    rateLimitPerSecond?: number;
    enableCircuitBreaker?: boolean;
  };
}
