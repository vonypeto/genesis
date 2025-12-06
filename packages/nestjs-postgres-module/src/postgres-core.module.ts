import {
  DynamicModule,
  Global,
  Module,
  Provider,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Pool } from 'pg';
import {
  PostgresModuleAsyncOptions,
  PostgresModuleOptions,
  PostgresOptionsFactory,
} from './postgres.interface';
import { Tokens } from './types';

@Global()
@Module({})
export class PostgresCoreModule implements OnApplicationShutdown {
  static forRoot(options: PostgresModuleOptions): DynamicModule {
    const postgresOptionsProvider: Provider = {
      provide: Tokens.PostgreModuleOptions,
      useValue: options,
    };

    const connectionProvider: Provider = {
      provide: Tokens.PostgreConnection,
      useFactory: async (options: PostgresModuleOptions) => {
        return new Pool(options);
      },
      inject: [Tokens.PostgreModuleOptions],
    };

    return {
      module: PostgresCoreModule,
      providers: [postgresOptionsProvider, connectionProvider],
      exports: [connectionProvider],
    };
  }

  static forRootAsync(options: PostgresModuleAsyncOptions): DynamicModule {
    const connectionProvider: Provider = {
      provide: Tokens.PostgreConnection,
      useFactory: async (options: PostgresModuleOptions) => {
        return new Pool(options);
      },
      inject: [Tokens.PostgreModuleOptions],
    };

    return {
      module: PostgresCoreModule,
      imports: options.imports || [],
      providers: [...this.createAsyncProviders(options), connectionProvider],
      exports: [connectionProvider],
    };
  }

  onApplicationShutdown() {
    // We could close pool here if injected, but tricky with static methods without constructor injection.
    // For now relying on simple pool management.
  }

  private static createAsyncProviders(
    options: PostgresModuleAsyncOptions
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }
    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: options.useClass as any,
        useClass: options.useClass as any,
      },
    ];
  }

  private static createAsyncOptionsProvider(
    options: PostgresModuleAsyncOptions
  ): Provider {
    if (options.useFactory) {
      return {
        provide: Tokens.PostgreModuleOptions,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }
    return {
      provide: Tokens.PostgreModuleOptions,
      useFactory: async (optionsFactory: PostgresOptionsFactory) =>
        await optionsFactory.createPostgresOptions(),
      inject: [options.useExisting || (options.useClass as any)],
    };
  }
}
