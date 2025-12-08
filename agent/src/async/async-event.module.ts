import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@genesis/config';
import { AsyncEventModule } from '@genesis/async-event-module';
import { MemberAccountAsyncEventService } from './account-creatation.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AsyncEventModule.forRootAsync({
      imports: [ConfigModule],

      useFactory: (...args: unknown[]) => {
        const config = args[0] as ConfigService;
        return {
          context: 'agent',
          kafka: {
            brokers: (
              config.getString('KAFKA_BROKERS', { optional: true }) ||
              'localhost:9092'
            )
              .split(',')
              .map((b) => b.trim())
              .filter(Boolean),
          },
          concurrency:
            config.getNumber('ASYNC_EVENT_CONCURRENCY', { optional: true }) ??
            5,
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [MemberAccountAsyncEventService],
})
export class AsyncModule {}
