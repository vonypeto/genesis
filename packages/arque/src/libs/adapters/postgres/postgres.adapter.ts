
import { Event, Snapshot, EventId } from '../../types';
import { StoreAdapter, AggregateVersionConflictError, AggregateIsFinalError } from '../../store-adapter';
import { Pool, PoolClient } from 'pg';
import { backOff } from 'exponential-backoff';
import { Joser, Serializer } from '../../joser';
import debug from 'debug';
import assert from 'assert';
import Queue from 'p-queue';
import { match, P } from 'ts-pattern';

type Options = {
  readonly connectionString: string;
  readonly retryStartingDelay: number;
  readonly retryMaxDelay: number;
  readonly retryMaxAttempts: number;
  readonly serializers: Serializer<unknown, unknown>[];
  readonly maxPoolSize?: number;
  readonly minPoolSize?: number;
  readonly schema?: string; // Schema name, defaults to public
};

export type PostgresStoreAdapterOptions = Partial<Options>;

export class PostgresStoreAdapter implements StoreAdapter {
  private readonly logger = {
    info: debug('arque:info:PostgresStoreAdapter'),
    error: debug('arque:error:PostgresStoreAdapter'),
    warn: debug('arque:warn:PostgresStoreAdapter'),
    verbose: debug('arque:verbose:PostgresStoreAdapter'),
    debug: debug('arque:debug:PostgresStoreAdapter'),
  };

  private readonly joser: Joser;
  private readonly opts: Options;
  private pool: Pool;
  private readonly schema: string;

  private readonly saveSnapshotQueue = new Queue({
    autoStart: true,
    concurrency: 1,
  });

  constructor(opts?: Partial<Options>) {
    this.opts = {
      connectionString: opts?.connectionString ?? 'postgresql://postgres:postgres@localhost:5432/arque',
      retryStartingDelay: opts?.retryStartingDelay ?? 100,
      retryMaxDelay: opts?.retryMaxDelay ?? 1600,
      retryMaxAttempts: opts?.retryMaxAttempts ?? 20,
      serializers: opts?.serializers ?? [],
      schema: opts?.schema ?? 'public',
      maxPoolSize: opts?.maxPoolSize,
      minPoolSize: opts?.minPoolSize
    };
    
    this.schema = this.opts.schema || 'public';

    this.joser = new Joser({
      serializers: [
        {
          type: Buffer,
          serialize: (value: Buffer) => '\\x' + value.toString('hex'), // Bytea format for PG
          deserialize: (value: any) => {
             if (Buffer.isBuffer(value)) return value;
             if (typeof value === 'string' && value.startsWith('\\x')) {
                 return Buffer.from(value.substring(2), 'hex');
             }
             return value;
          },
        },
        {
          type: Date,
          serialize: (value: Date) => value.toISOString(),
          deserialize: (value: string | Date) => new Date(value),
        },
        ...(this.opts.serializers),
      ],
    });
    
    this.pool = new Pool({
        connectionString: this.opts.connectionString,
        max: this.opts.maxPoolSize,
        min: this.opts.minPoolSize
    });
  }

  private serialize(value: unknown) {
    return match(value)
      .with(P.union(P.nullish, P.number, P.string, P.boolean), (value) => value)
      .with(P.instanceOf(Buffer), (value) => '\\x' + value.toString('hex'))
      .otherwise((value) => this.joser.serialize(value));
  }
  
  // Helper to serialize specific fields like body/meta to JSON
  private serializeJson(value: unknown) {
      return JSON.stringify(this.serialize(value));
  }

  private deserialize(value: unknown) {
      if (typeof value === 'string' && value.startsWith('\\x')) {
          return Buffer.from(value.substring(2), 'hex');
      }
      return this.joser.deserialize(value);
  }

  public async init() {
     // Ensure tables exist
     // This is a basic migration strategy.
     const client = await this.pool.connect();
     try {
         await client.query(`CREATE SCHEMA IF NOT EXISTS "${this.schema}";`);
         
         await client.query(`
            CREATE TABLE IF NOT EXISTS "${this.schema}".events (
                id BYTEA PRIMARY KEY,
                type INTEGER NOT NULL,
                aggregate_id BYTEA NOT NULL,
                aggregate_version INTEGER NOT NULL,
                body JSONB,
                meta JSONB,
                timestamp TIMESTAMP DEFAULT NOW(),
                final BOOLEAN DEFAULT FALSE,
                UNIQUE(aggregate_id, aggregate_version)
            );
            CREATE INDEX IF NOT EXISTS idx_events_aggregate_id_version ON "${this.schema}".events (aggregate_id, aggregate_version);
            CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON "${this.schema}".events (type, timestamp DESC);
            
            CREATE TABLE IF NOT EXISTS "${this.schema}".aggregates (
                id BYTEA PRIMARY KEY,
                version INTEGER NOT NULL,
                timestamp TIMESTAMP DEFAULT NOW(),
                final BOOLEAN DEFAULT FALSE
            );
            
            CREATE TABLE IF NOT EXISTS "${this.schema}".snapshots (
                aggregate_id BYTEA NOT NULL,
                aggregate_version INTEGER NOT NULL,
                state JSONB,
                timestamp TIMESTAMP DEFAULT NOW(),
                UNIQUE(aggregate_id, aggregate_version)
            );
            CREATE INDEX IF NOT EXISTS idx_snapshots_aggregate_id_version ON "${this.schema}".snapshots (aggregate_id, aggregate_version DESC);
            
            CREATE TABLE IF NOT EXISTS "${this.schema}".projection_checkpoints (
                projection TEXT NOT NULL,
                aggregate_id BYTEA NOT NULL,
                aggregate_version INTEGER NOT NULL,
                timestamp TIMESTAMP DEFAULT NOW(),
                UNIQUE(projection, aggregate_id)
            );
         `);
     } finally {
         client.release();
     }
  }

  async saveProjectionCheckpoint(params: { projection: string; aggregate: { id: Buffer; version: number; }; }): Promise<void> {
    const client = await this.pool.connect();
    try {
        await client.query(`
            INSERT INTO "${this.schema}".projection_checkpoints (projection, aggregate_id, aggregate_version, timestamp)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (projection, aggregate_id)
            DO UPDATE SET aggregate_version = $3, timestamp = NOW();
        `, [params.projection, params.aggregate.id, params.aggregate.version]);
    } finally {
        client.release();
    }
  }

  async checkProjectionCheckpoint(params: { projection: string; aggregate: { id: Buffer; version: number; }; }): Promise<boolean> {
    const res = await this.pool.query(`
        SELECT COUNT(*) FROM "${this.schema}".projection_checkpoints 
        WHERE projection = $1 AND aggregate_id = $2 AND aggregate_version >= $3
    `, [params.projection, params.aggregate.id, params.aggregate.version]);
    
    return parseInt(res.rows[0].count, 10) === 0;
  }

  async finalizeAggregate(params: { id: Buffer; }) {
      await backOff(async() => {
          const client = await this.pool.connect();
          try {
              await client.query('BEGIN');
              
              await client.query(`
                  UPDATE "${this.schema}".aggregates SET final = TRUE WHERE id = $1
              `, [params.id]);
              
              await client.query(`
                  UPDATE "${this.schema}".events SET final = TRUE WHERE aggregate_id = $1
              `, [params.id]);
              
              await client.query('COMMIT');
          } catch (e) {
              await client.query('ROLLBACK');
              throw e;
          } finally {
              client.release();
          }
      }, {
        startingDelay: this.opts.retryStartingDelay,
        maxDelay: this.opts.retryMaxDelay,
        numOfAttempts: this.opts.retryMaxAttempts,
        jitter: 'full',
        retry: (err) => {
            // Check for PG specific concurrency errors (e.g. 40001 serialization_failure)
             const code = (err as any).code;
             return code === '40001' || code === '40P01'; // deadlock
        }
      });
  }
  
  async saveEvents(params: {
    aggregate: { id: Buffer; version: number; };
    timestamp: Date;
    events: Pick<Event, 'id' | 'type' | 'body' | 'meta'>[];
    meta?: Event['meta'];
  }): Promise<void> {
      assert(params.aggregate.version > 0, 'aggregate version must be greater than 0');
      
      const client = await this.pool.connect();
      try {
          // Check if final outside transaction first (optimization, though standard says verify inside)
           const aggRes = await client.query(`SELECT final FROM "${this.schema}".aggregates WHERE id = $1`, [params.aggregate.id]);
           if (aggRes.rows[0]?.final) {
               throw new AggregateIsFinalError(params.aggregate.id);
           }
      } finally {
          client.release();
      }
      
      await backOff(async () => {
          const client = await this.pool.connect();
          try {
              await client.query('BEGIN');
              
              if (params.aggregate.version === 1) {
                  try {
                      await client.query(`
                          INSERT INTO "${this.schema}".aggregates (id, version, timestamp)
                          VALUES ($1, $2, $3)
                      `, [params.aggregate.id, params.events.length, params.timestamp]);
                  } catch (err: any) {
                      if (err.code === '23505') { // Unique violation
                         throw new AggregateVersionConflictError(params.aggregate.id, params.aggregate.version);
                      }
                      throw err;
                  }
              } else {
                  const res = await client.query(`
                      UPDATE "${this.schema}".aggregates 
                      SET version = $2 + $3 - 1, timestamp = $4
                      WHERE id = $1 AND version = $2 - 1 AND final = FALSE
                  `, [params.aggregate.id, params.aggregate.version, params.events.length, params.timestamp]);
                  
                  if (res.rowCount === 0) {
                      throw new AggregateVersionConflictError(params.aggregate.id, params.aggregate.version);
                  }
              }
              
              // Insert events
              for (let i = 0; i < params.events.length; i++) {
                  const event = params.events[i];
                  await client.query(`
                      INSERT INTO "${this.schema}".events (id, type, aggregate_id, aggregate_version, body, meta, timestamp)
                      VALUES ($1, $2, $3, $4, $5, $6, $7)
                  `, [
                      event.id.buffer, 
                      event.type, 
                      params.aggregate.id, 
                      params.aggregate.version + i,
                      // We need to carefully handle JSON support in Joser. 
                      // Here we use JSON.stringify on the serialized object
                      JSON.stringify(this.serialize(event.body)),
                      JSON.stringify(this.serialize({ ...event.meta, ...params.meta })),
                      params.timestamp
                  ]);
              }
              
              await client.query('COMMIT');
          } catch (err) {
              await client.query('ROLLBACK');
              throw err;
          } finally {
              client.release();
          }
      }, {
         startingDelay: this.opts.retryStartingDelay,
        maxDelay: this.opts.retryMaxDelay,
        numOfAttempts: this.opts.retryMaxAttempts,
        jitter: 'full',
         retry: (err) => {
             const code = (err as any).code;
             return code === '40001' || code === '40P01'; 
        }
      });
  }


  async listEvents<TEvent = Event>(params: {
    aggregate?: {
      id: Buffer;
      version?: number;
    };
    type?: number;
  }): Promise<AsyncIterableIterator<TEvent>> {
      let queryText = `SELECT * FROM "${this.schema}".events`;
      const _this = this;
      let conditions: string[] = [];
      let values: any[] = [];
      let orderBy = '';
      
      if (params.aggregate) {
          conditions.push(`aggregate_id = $${values.length + 1}`);
          values.push(params.aggregate.id);
          
          if (params.aggregate.version) {
              conditions.push(`aggregate_version > $${values.length + 1}`);
              values.push(params.aggregate.version);
          }
          orderBy = `ORDER BY aggregate_id ASC, aggregate_version ASC`;
      }
      
      if (params.type !== undefined) {
          conditions.push(`type = $${values.length + 1}`);
          values.push(params.type);
          orderBy = `ORDER BY type ASC, timestamp ASC`;
      }
      
      if (conditions.length > 0) {
          queryText += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      queryText += ` ${orderBy}`;
      
      
      // Using a generator function to properly satisfy AsyncIterableIterator
      async function* eventGenerator() {
           const client = await _this.pool.connect();
           try {
               const res = await client.query(queryText, values);
               for(const row of res.rows) {
                   yield {
                       id: EventId.from(row.id),
                       type: row.type,
                       aggregate: {
                         id: row.aggregate_id,
                         version: row.aggregate_version  
                       },
                       body: _this.deserialize(row.body),
                       meta: _this.deserialize(row.meta),
                       timestamp: row.timestamp
                   } as any;
               }
           } finally {
               client.release();
           }
      }

      return eventGenerator();
  }

  async saveSnapshot(params: Snapshot) {
    await this.saveSnapshotQueue.add(async () => {
         const client = await this.pool.connect();
         try {
             await client.query(`
                 INSERT INTO "${this.schema}".snapshots (aggregate_id, aggregate_version, state, timestamp)
                 VALUES ($1, $2, $3, $4)
             `, [
                 params.aggregate.id, 
                 params.aggregate.version, 
                 JSON.stringify(this.serialize(params.state)), 
                 params.timestamp
             ]);
         } finally {
             client.release();
         }
    });
  }

  async findLatestSnapshot<T = unknown>(params: { aggregate: { id: Buffer; version: number; }; }): Promise<Snapshot<T> | null> {
    const res = await this.pool.query(`
        SELECT * FROM "${this.schema}".snapshots
        WHERE aggregate_id = $1 AND aggregate_version > $2
        ORDER BY aggregate_version DESC
        LIMIT 1
    `, [params.aggregate.id, params.aggregate.version]);
    
    if (res.rowCount === 0) return null;
    
    const row = res.rows[0];
    return {
        aggregate: {
            id: row.aggregate_id,
            version: row.aggregate_version
        },
        state: this.deserialize(row.state) as T,
        timestamp: row.timestamp
    };
  }

  async close(): Promise<void> {
    await this.saveSnapshotQueue.onIdle();
    await this.pool.end();
  }
}
