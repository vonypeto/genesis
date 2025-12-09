
export * from './libs/types';
export * from './libs/store-adapter';
export * from './libs/joser';
export * from './libs/adapters/mongo/mongo.adapter';
export * from './libs/adapters/postgres/postgres.adapter';

import { StoreAdapter } from './libs/store-adapter';
import { MongoStoreAdapter, MongoStoreAdapterOptions } from './libs/adapters/mongo/mongo.adapter';
import { PostgresStoreAdapter, PostgresStoreAdapterOptions } from './libs/adapters/postgres/postgres.adapter';

export type ArqueConfig = 
  | ({ type: 'mongo' } & MongoStoreAdapterOptions)
  | ({ type: 'postgres' } & PostgresStoreAdapterOptions);

export function createStoreAdapter(config: ArqueConfig): StoreAdapter {
  if (config.type === 'mongo') {
    return new MongoStoreAdapter(config);
  } else if (config.type === 'postgres') {
    return new PostgresStoreAdapter(config);
  } else {
    throw new Error(`Unsupported store adapter type: ${(config as any).type}`);
  }
}
