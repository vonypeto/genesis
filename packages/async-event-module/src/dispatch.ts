import { Logger } from '@nestjs/common';
import { CompressionTypes, Producer } from 'kafkajs';
import { AsyncEvent } from './types';

export async function dispatch(
  dependencies: {
    producer: Producer;
    logger?: Logger;
  },
  context: string | string[],
  event: AsyncEvent,
  opts?: { category?: string }
) {
  const topics = (Array.isArray(context) ? context : [context]).map(
    (topic) => `async-event-${topic}`
  );

  const message = {
    value: Buffer.from(JSON.stringify(event), 'utf8'),
    headers: {
      category: opts?.category ?? undefined,
      type: event.type,
    },
  } as const;

  await dependencies.producer
    .sendBatch({
      compression: CompressionTypes.GZIP,
      topicMessages: topics.map((topic) => ({
        topic,
        messages: [message],
      })),
    })
    .catch((error) => {
      dependencies.logger?.error(
        `failed to dispatch async event: ${String(error)}`
      );
    });
}
