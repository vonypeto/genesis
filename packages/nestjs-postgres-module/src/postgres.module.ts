import { DynamicModule, Module } from '@nestjs/common';
import { PostgresCoreModule } from './postgres-core.module';
import { PostgresModuleAsyncOptions, PostgresModuleOptions } from './postgres.interface';

@Module({})
export class PostgresModule {
  static forRoot(options: PostgresModuleOptions): DynamicModule {
    return {
      module: PostgresModule,
      imports: [PostgresCoreModule.forRoot(options)],
    };
  }

  static forRootAsync(options: PostgresModuleAsyncOptions): DynamicModule {
    return {
      module: PostgresModule,
      imports: [PostgresCoreModule.forRootAsync(options)],
    };
  }
}
