import { LLMProvider } from '../../features/llm-agent-model/libs/types';

export interface LLMProviderConfig {
  model: string;
  provider: LLMProvider | string;
  timeout?: number;
  maxRetries?: number;
  useCircuitBreaker?: boolean;
}
