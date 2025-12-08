import {
  DynamicModule,
  Inject,
  Module,
  ModuleMetadata,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, Reflector } from '@nestjs/core';
import Redis, { Cluster } from 'ioredis';
import { Consumer, Kafka, logLevel } from 'kafkajs';
import { Tokens } from './tokens';
import {
  AsyncEvent,
  AsyncEventModuleOptions,
  AsyncEventOptions,
} from './types';

export type AsyncEventModuleAsyncOptions = Pick<ModuleMetadata, 'imports'> & {
  useFactory?: (
    ...args: unknown[]
  ) => Promise<AsyncEventModuleOptions> | AsyncEventModuleOptions;
  inject?: unknown[];
};

@Module({
  imports: [DiscoveryModule],
})
export class AsyncEventModule
  implements OnModuleDestroy, OnApplicationBootstrap
{
  private readonly logger: Logger;

  constructor(
    private readonly discovery: DiscoveryService,
    @Inject(Tokens.AsyncEventHandlers)
    private readonly handlers: Map<
      string,
      {
        handler: (event: AsyncEvent, opts?: AsyncEventOptions) => Promise<void>;
        opts: { deduplication?: { ttl: number } | null };
      }
    >,
    @Inject(Tokens.AsyncEventModuleOptions)
    private readonly options: AsyncEventModuleOptions,
    @Inject(Tokens.KafkaConsumer)
    private readonly consumer: Consumer,
    @Inject(Tokens.Redis)
    private readonly redis?: Cluster
  ) {
    this.logger = new Logger('AsyncEventModule');
  }

  async onApplicationBootstrap() {
    const reflector = new Reflector();

    for (const provider of this.discovery.getProviders()) {
      if (!provider.metatype || !provider.instance) continue;

      const instance = provider.instance;
      const prototype = Object.getPrototypeOf(instance);

      for (const name of Object.getOwnPropertyNames(prototype)) {
        if (name === 'constructor') continue;

        const descriptor = Object.getOwnPropertyDescriptor(prototype, name);

        if (!descriptor || typeof descriptor.value !== 'function') continue;

        const metadata = reflector.get('AsyncEventHandler', descriptor.value);

        if (metadata) {
          const [event, opts] = metadata;

          this.logger.log('async event handler registered', {
            event,
            method: name,
            opts,
          });

          this.handlers.set(event, {
            handler: instance[name].bind(instance),
            opts,
          });
        }
      }
    }

    await this.consumer.subscribe({
      topics: [`async-event-${this.options.context}`],
    });

    await this.consumer.run({
      partitionsConsumedConcurrently: this.options.concurrency ?? 5,
      eachMessage: async ({ message, heartbeat }) => {
        if (
          !['development', 'staging', 'production'].includes(
            process.env['NODE_ENV'] || 'development'
          )
        ) {
          const type = String(message.headers?.['type'] ?? '');

          const handler = this.handlers.get(type);

          if (!handler) {
            this.options.logger?.warn('handler does not exist', {
              event: type,
            });

            return;
          }

          if (handler.opts.deduplication && this.redis) {
            const idHeader = String(message.headers?.['id'] ?? '');
            const key = `async-event:${this.options.context}:${type}:${idHeader}`;

            const result = await this.redis.set(
              key,
              '1',
              'PX',
              handler.opts.deduplication.ttl,
              'NX'
            );

            if (result === null) {
              this.logger.error(`event is a duplicate: ${type}:${idHeader}`);

              return;
            }
          }
        }

        let event: AsyncEvent;

        try {
          if (!message.value) {
            this.logger.error('async event message value is null');
            return;
          }
          event = JSON.parse(message.value.toString('utf8')) as AsyncEvent;
        } catch (error) {
          this.logger.error(`failed to parse async event: ${String(error)}`);

          return;
        }

        const handler = this.handlers.get(event.type);

        if (!handler) {
          this.logger.warn(`handler does not exist for event: ${event.type}`);

          return;
        }

        if (this.options.onAsyncEventReceived) {
          try {
            await this.options.onAsyncEventReceived(
              event,
              this.options.context
            );
          } catch (error) {
            this.logger.error(
              `error occurred in onAsyncEventReceived hook: ${String(error)}`
            );
          }
        }

        try {
          this.logger.verbose(`handling event: ${event.type}`);

          const timestamp = new Date();

          await handler.handler(event, { heartbeat, timestamp });

          this.logger.verbose(
            `event handled: ${event.type} in ${
              Date.now() - timestamp.getTime()
            }ms`
          );
        } catch (error) {
          this.logger.error(
            `error occurred while handling async event: ${String(error)}`
          );
        }

        if (this.options.onAsyncEventProcessed) {
          try {
            await this.options.onAsyncEventProcessed(
              event,
              this.options.context
            );
          } catch (error) {
            this.logger.error(
              `error occurred in onAsyncEventProcessed hook: ${String(error)}`
            );
          }
        }
      },
    });
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();

    await this.redis?.disconnect();
  }

  public static forRootAsync(
    options: AsyncEventModuleAsyncOptions
  ): DynamicModule {
    return {
      global: true,
      module: AsyncEventModule,
      providers: [
        {
          provide: Tokens.AsyncEventModuleOptions,
          useFactory:
            options.useFactory ?? (() => ({} as AsyncEventModuleOptions)),
          inject: <never>(options.inject || []),
        },
        {
          provide: Tokens.AsyncEventHandlers,
          useFactory: () => {
            return new Map<string, unknown>();
          },
        },
        {
          provide: Tokens.Kafka,
          useFactory: (options: AsyncEventModuleOptions) => {
            const kafka = new Kafka({
              clientId: options.context,
              brokers: options.kafka.brokers,
              logLevel: logLevel.ERROR,
            });

            return kafka;
          },
          inject: [Tokens.AsyncEventModuleOptions],
        },
        {
          provide: Tokens.KafkaConsumer,
          useFactory: async (
            kafka: Kafka,
            options: AsyncEventModuleOptions
          ) => {
            const consumer = kafka.consumer({
              groupId: `async-event-${options.context}`,
              allowAutoTopicCreation: true,
              heartbeatInterval: 5_000,
              sessionTimeout: 2 * 60_000, // session timeout is 2 minutes
            });

            await consumer.connect();

            return consumer;
          },
          inject: [Tokens.Kafka, Tokens.AsyncEventModuleOptions],
        },
        {
          provide: Tokens.Redis,
          useFactory: async (options: AsyncEventModuleOptions) => {
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
          inject: [Tokens.AsyncEventModuleOptions],
        },
      ],
    };
  }
}
