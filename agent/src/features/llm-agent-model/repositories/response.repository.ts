import { MongooseRepository, Repository } from '@genesis/repository';
import { Connection, Schema } from 'mongoose';

export enum ResponseStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  RATE_LIMITED = 'rate_limited',
}

export type Response = {
  id: string;
  runId: string;
  promptId: string;
  modelName: string;
  provider: string;
  latencyMs: number;
  rawText: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, any>;
  status: ResponseStatus;
  errorMessage?: string;
  retryCount: number;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ResponseRepository = Repository<Response>;

export function ResponseRepositoryFactory(
  connection: Connection
): ResponseRepository {
  return new MongooseRepository<Response>(
    connection,
    'Response',
    {
      runId: { type: Schema.Types.ObjectId, required: true, ref: 'Run' },
      promptId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'Prompt',
      },
      modelName: { type: String, required: true },
      provider: { type: String, required: true },
      latencyMs: { type: Number, required: true },
      rawText: String,
      tokenUsage: {
        promptTokens: Number,
        completionTokens: Number,
        totalTokens: Number,
      },
      metadata: Schema.Types.Mixed,
      status: {
        type: String,
        enum: Object.values(ResponseStatus),
        required: true,
      },
      errorMessage: String,
      retryCount: { type: Number, default: 0 },
      timestamp: { type: Date, default: Date.now },
    },
    [
      [{ runId: 1 }],
      [{ promptId: 1 }],
      [{ modelName: 1 }],
      [{ runId: 1, status: 1 }],
      [{ runId: 1, promptId: 1, modelName: 1 }],
    ]
  );
}
