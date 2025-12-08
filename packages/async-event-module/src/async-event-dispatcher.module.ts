import {
  DynamicModule,
  Inject,
  Module,
  ModuleMetadata,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Tokens } from './tokens';
import { AsyncEventDispatcherModuleOptions } from './types';
import { Kafka, logLevel, Producer } from 'kafkajs';
import { Queue, Worker } from 'bullmq';
import { AsyncEventDispatcherService } from './async-event-dispatcher.service';
import { randomBytes } from 'crypto';
import { dispatch } from './dispatch';
import Redis, { Cluster } from 'ioredis';

export type AsyncEventDispatcherModuleAsyncOptions = Pick<
  ModuleMetadata,
  'imports'
> & {
  useFactory?: (
    ...args: unknown[]
  ) =>
    | Promise<AsyncEventDispatcherModuleOptions>
    | AsyncEventDispatcherModuleOptions;
  inject?: unknown[];
};

@Module({})
export class AsyncEventDispatcherModule implements OnModuleDestroy {
  constructor(
    @Inject(Tokens.KafkaProducer)
    private readonly producer: Producer,
    @Inject(Tokens.BullMQQueue)
    private readonly queue?: Queue,
    @Inject(Tokens.BullMQWorker)
    private readonly worker?: Worker,
    @Inject(Tokens.Redis)
    private readonly redis?: Cluster
  ) {}

  async onModuleDestroy() {
    await this.queue?.close();

    await this.worker?.close();

    await this.producer.disconnect();

    await this.redis?.disconnect();
  }

  public static forRootAsync(
    options: AsyncEventDispatcherModuleAsyncOptions
  ): DynamicModule {
    return {
      global: true,
      module: AsyncEventDispatcherModule,
      providers: [
        {
          provide: Tokens.AsyncEventDispatchModuleOptions,
          useFactory: (...args: unknown[]) => {
            if (!options.useFactory) {
              throw new Error(
                'AsyncEventDispatcherModule: useFactory is required'
              );
            }
            return options.useFactory(...args);
          },
          inject: <never>(options.inject || []),
        },
        {
          provide: Tokens.Redis,
          useFactory: async (options: AsyncEventDispatcherModuleOptions) => {
            if (!options.redis) {
              return;
            }

            if ('cluster' in options.redis) {
              const redis = new Redis.Cluster(options.redis.cluster.nodes, {
                lazyConnect: true,
              });

              await redis.connect();

              return redis;
            }

            const redis = new Redis(
              options.redis.port ?? 6379,
              options.redis.host,
              {
                lazyConnect: true,
                maxRetriesPerRequest: null,
              }
            );

            await redis.connect();

            return redis;
          },
          inject: [Tokens.AsyncEventDispatchModuleOptions],
        },
        {
          provide: Tokens.BullMQQueue,
          useFactory: async (
            options: AsyncEventDispatcherModuleOptions,
            redis?: Cluster
          ) => {
            if (!redis) {
              return;
            }

            const queue = new Queue(`{async-event-${options.id}}`, {
              connection: redis as any,
              defaultJobOptions: {
                removeOnComplete: true,
                removeOnFail: true,
              },
            });

            await queue.waitUntilReady();

            return queue;
          },
          inject: [Tokens.AsyncEventDispatchModuleOptions, Tokens.Redis],
        },
        {
          provide: Tokens.BullMQWorker,
          useFactory: async (
            options: AsyncEventDispatcherModuleOptions,
            producer: Producer,
            redis?: Cluster
          ) => {
            if (!options.redis) {
              return;
            }

            const worker = new Worker(
              `{async-event-${options.id}}`,
              async (job) => {
                const { context, event, opts } = job.data;

                await dispatch(
                  {
                    producer,
                    logger: new Logger('AsyncEventDispatcher'),
                  },
                  context,
                  event,
                  opts
                );
              },
              {
                removeOnComplete: {
                  count: 32,
                },
                removeOnFail: {
                  count: 256,
                },
                connection: redis as any,
                concurrency: options.bullmq?.worker?.concurrency ?? 1,
              }
            );

            await worker.waitUntilReady();

            return worker;
          },
          inject: [
            Tokens.AsyncEventDispatchModuleOptions,
            Tokens.KafkaProducer,
            Tokens.Redis,
          ],
        },
        {
          provide: Tokens.Kafka,
          useFactory: (options: AsyncEventDispatcherModuleOptions) => {
            const kafka = new Kafka({
              clientId: `async-event-dispatcher-${options.id}`,
              brokers: options.kafka.brokers,
              logLevel: logLevel.ERROR,
            });

            return kafka;
          },
          inject: [Tokens.AsyncEventDispatchModuleOptions],
        },
        {
          provide: Tokens.KafkaProducer,
          useFactory: async (
            kafka: Kafka,
            options: AsyncEventDispatcherModuleOptions
          ) => {
            const producer = kafka.producer({
              transactionTimeout: options.kafka.transactionTimeout ?? 30_000,
              idempotent: true,
              createPartitioner:
                () =>
                ({ partitionMetadata, message }) => {
                  if (!options.categories || !message.headers?.['category']) {
                    return (
                      randomBytes(4).readUInt32BE() % partitionMetadata.length
                    );
                  }

                  const total = options.categories.reduce(
                    (sum, category) => sum + category.allocation,
                    0
                  );

                  let lowAccum = 0;
                  let highAccum = 0;
                  const targetCategory = String(
                    message.headers?.['category'] ?? ''
                  );
                  for (const cat of options.categories) {
                    const nextHigh = lowAccum + cat.allocation;
                    if (cat.name === targetCategory) {
                      highAccum = nextHigh;
                      break;
                    }
                    lowAccum = nextHigh;
                  }

                  const low = lowAccum / total;
                  const high = highAccum / total;

                  return Math.floor(
                    (Math.random() * (high - low) + low) *
                      partitionMetadata.length
                  );
                },
            });

            await producer.connect();

            return producer;
          },
          inject: [Tokens.Kafka, Tokens.AsyncEventDispatchModuleOptions],
        },
        AsyncEventDispatcherService,
      ],
      exports: [AsyncEventDispatcherService],
    };
  }
}
