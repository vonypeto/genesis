import { ModuleMetadata, Type } from '@nestjs/common';
import { PoolConfig } from 'pg';

export interface PostgresModuleOptions extends PoolConfig {
  isGlobal?: boolean;
}

export interface PostgresOptionsFactory {
  createPostgresOptions(): Promise<PostgresModuleOptions> | PostgresModuleOptions;
}

export interface PostgresModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<PostgresOptionsFactory>;
  useClass?: Type<PostgresOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<PostgresModuleOptions> | PostgresModuleOptions;
  inject?: any[];
  isGlobal?: boolean;
}
