import { MongooseRepository, Repository } from '@genesis/repository';
import { Connection, Schema } from 'mongoose';

export enum RunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial',
  CANCELLED = 'cancelled',
}

export type Run = {
  id: string;
  notes?: string;
  status: RunStatus;
  totalPrompts: number;
  completedPrompts: number;
  failedPrompts: number;
  startedAt?: Date;
  completedAt?: Date;
  idempotencyKey?: string;
  contentHash?: string;
  config: {
    brands: string[];
    models: string[];
    concurrencyLimit: number;
    retryAttempts: number;
    timeout: number;
  };
  metrics?: {
    totalDurationMs?: number;
    avgLatencyMs?: number;
    totalTokensUsed?: number;
    estimatedCost?: number;
  };
  createdAt: Date;
  updatedAt: Date;
};

export type RunRepository = Repository<Run>;

export function RunRepositoryFactory(connection: Connection): RunRepository {
  return new MongooseRepository<Run>(
    connection,
    'Run',
    {
      notes: String,
      status: {
        type: String,
        enum: Object.values(RunStatus),
        default: RunStatus.PENDING,
      },
      totalPrompts: { type: Number, default: 0 },
      completedPrompts: { type: Number, default: 0 },
      failedPrompts: { type: Number, default: 0 },
      startedAt: Date,
      completedAt: Date,
      idempotencyKey: { type: String, index: true, sparse: true },
      contentHash: String,
      config: {
        brands: [String],
        models: [String],
        concurrencyLimit: { type: Number, default: 5 },
        retryAttempts: { type: Number, default: 3 },
        timeout: { type: Number, default: 30000 },
        rateLimitPerSecond: Number,
      },
      metrics: {
        totalDurationMs: Number,
        avgLatencyMs: Number,
        totalTokensUsed: Number,
        estimatedCost: Number,
      },
    },
    [[{ contentHash: 1 }], [{ status: 1 }], [{ createdAt: -1 }]]
  );
}
