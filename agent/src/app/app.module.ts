import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './controllers/app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@genesis/config';
import { AccountModule } from '../features/account-model/account.module';
import { LLMAgentModule } from '../features/llm-agent-model/llm-agent.module';
import { AccountController } from './controllers/account.controller';

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
    AccountModule,
    LLMAgentModule,
  ],
  controllers: [AppController, AccountController],
  providers: [AppService],
})
export class AppModule {}
