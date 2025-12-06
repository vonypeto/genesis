import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './controllers/app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@genesis/config';
import { AccountModule } from '../features/account-model/account.module';
import { LLMAgentModule } from '../features/llm-agent-model/llm-agent.module';
import { AccountController } from './controllers/account.controller';
import { AgentController } from './controllers/agent.controller';
import { RateLimiterService } from '@genesis/rate-limiter';
import { RedisService } from '@genesis/redis';
import { PostgresAccountModule } from '../features/postgres-account-model/postgres-account.module';
import { PostgresAccountController } from './controllers/postgres-account.controller';
import { PostgresModule } from '@genesis/postgres';
import fs from 'fs';
import path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRootAsync({
      useFactory: async (config: ConfigService) => ({
        uri: config.getString('LLM_MONGODB_URI'),
        minPoolSize: Math.floor(
          (config.getNumber('MONGODB_POOL_SIZE', { optional: true }) ?? 10) *
            0.4
        ),
        maxPoolSize:
          config.getNumber('MONGODB_POOL_SIZE', { optional: true }) ?? 10,
        socketTimeoutMS: 60000,
        heartbeatFrequencyMS: 2000,
        serverSelectionTimeoutMS: 30000,
        autoIndex: config.getString('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    PostgresModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => {
        const connectionString = config.getString('POSTGRE_URI', {
          optional: true,
        });
        const production =
          (config.getString('NODE_ENV', { optional: true }) ||
            'development') === 'production';

        const caPath = config.getString('POSTGRE_SSL_CA_PATH', {
          optional: true,
        });

        const ssl: false | { rejectUnauthorized: boolean; ca?: string } =
          production
            ? caPath
              ? {
                  rejectUnauthorized: true,
                  ca: fs.readFileSync(
                    path.resolve(process.cwd(), caPath),
                    'utf8'
                  ),
                }
              : ({ rejectUnauthorized: false } as any)
            : false;

        return { connectionString, ssl };
      },
      inject: [ConfigService],
    }),
    AccountModule,
    LLMAgentModule,
    PostgresAccountModule,
  ],
  controllers: [
    AppController,
    AccountController,
    AgentController,
    PostgresAccountController,
  ],
  providers: [AppService, RedisService, RateLimiterService, RateLimiterService],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly redisService: RedisService,
    private readonly rateLimiterService: RateLimiterService
  ) {}

  onModuleInit() {
    const redisClient = this.redisService.getClient();
    this.rateLimiterService.initialize(redisClient);
    this.rateLimiterService.createProviderLimiters();
  }
}
