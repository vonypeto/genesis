import { Inject, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Producer } from 'kafkajs';
import { dispatch } from './dispatch';
import { Tokens } from './tokens';
import { AsyncEvent, AsyncEventDispatcherModuleOptions } from './types';

export class AsyncEventDispatcherService {
  private readonly logger: Logger;

  constructor(
    @Inject(Tokens.AsyncEventDispatchModuleOptions)
    private readonly options: AsyncEventDispatcherModuleOptions,
    @Inject(Tokens.KafkaProducer)
    private readonly producer: Producer,
    @Inject(Tokens.BullMQQueue)
    private readonly queue?: Queue
  ) {
    this.logger = new Logger('AsyncEventDispatcherService');
  }

  async dispatch<T extends AsyncEvent>(
    context: string | string[],
    event: T,
    opts?: { delay?: number; category?: string }
  ) {
    if (opts?.delay) {
      if (!this.queue) {
        this.logger.error(
          `Queue is not configured for delayed async event`,
          JSON.stringify({ context, event, opts })
        );

        return;
      }

      await this.queue.add(
        'DispatchDelayedAsyncEvent',
        { context, event, opts },
        {
          delay: opts.delay,
        }
      );

      return;
    }

    await dispatch(
      {
        producer: this.producer,
        logger: this.logger,
      },
      context,
      event,
      opts
    );
  }
}
