import { Repository, FilterQuery, UpdateQuery } from './types';
import { Pool, PoolClient } from 'pg';
import { ObjectId as GenObjectId, ObjectId } from '@genesis/object-id';
import { v4 as uuidv4 } from 'uuid';

export class PostgresRepository<T extends { id?: string | Buffer | ObjectId }>
  implements Repository<T>
{
  constructor(
    private readonly pool: Pool,
    private readonly tableName: string,
    private readonly schemaDefinition: Record<string, any>
  ) {}

  async initialize(): Promise<void> {
    await this.syncSchema();
  }

  private async syncSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Check if table exists
      const tableExistsRes = await client.query(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables 
           WHERE table_schema = 'public' 
           AND table_name = $1
         );`,
        [this.tableName]
      );

      if (!tableExistsRes.rows[0].exists) {
        // Create table
        const columns = Object.entries(this.schemaDefinition)
          .map(([key, type]) => {
            const pgType = this.mapTypeToPostgres(type);
            return `"${key}" ${pgType}`;
          })
          .join(', ');

        // Always add id if not present in definition (though interface expects generic T)
        // We'll require 'id' field to be primary key
        const createSql = `CREATE TABLE "${this.tableName}" (
          "id" TEXT PRIMARY KEY, 
          ${columns},
          "created_at" TIMESTAMP DEFAULT NOW(),
          "updated_at" TIMESTAMP DEFAULT NOW()
        );`;

        await client.query(createSql);
      } else {
        // Alter table - add missing columns
        const columnsRes = await client.query(
          `SELECT column_name FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = $1;`,
          [this.tableName]
        );
        const existingColumns = new Set(
          columnsRes.rows.map((r) => r.column_name)
        );

        for (const [key, type] of Object.entries(this.schemaDefinition)) {
          if (!existingColumns.has(key)) {
            const pgType = this.mapTypeToPostgres(type);
            await client.query(
              `ALTER TABLE "${this.tableName}" ADD COLUMN "${key}" ${pgType};`
            );
          }
        }
      }
    } finally {
      client.release();
    }
  }

  private mapTypeToPostgres(type: any): string {
    if (type === String || (type.type && type.type === String)) return 'TEXT';
    if (type === Number || (type.type && type.type === Number))
      return 'NUMERIC';
    if (type === Boolean || (type.type && type.type === Boolean))
      return 'BOOLEAN';
    if (type === Date || (type.type && type.type === Date)) return 'TIMESTAMP';
    return 'JSONB'; // Fallback for complex objects/arrays
  }

  async create(data: Partial<T>): Promise<T> {
    const id = data.id || ObjectId.generate();
    const now = new Date();
    const dataWithoutId = { ...data };
    if ('id' in dataWithoutId) delete dataWithoutId.id;
    const keys = [
      'id',
      ...Object.keys(dataWithoutId),
      'created_at',
      'updated_at',
    ];
    const values = [
      this.toIdString(id),
      ...Object.values(dataWithoutId),
      now,
      now,
    ];

    // remove keys that are not in schema (simple protection) + id/timestamps
    // For now assume data keys are valid columns for simplicity or mismatched columns will throw

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.map((k) => `"${k}"`).join(', ');

    const query = `INSERT INTO "${this.tableName}" (${columns}) VALUES (${placeholders}) RETURNING *;`;

    const res = await this.pool.query(query, values);
    return this.mapRow(res.rows[0]);
  }

  async createMany(data: Partial<T>[]): Promise<T[]> {
    const results: T[] = [];
    for (const item of data) {
      results.push(await this.create(item));
    }
    return results;
  }

  async findAll(page: number = 1, limit: number = 10): Promise<T[]> {
    const offset = (page - 1) * limit;
    const res = await this.pool.query(
      `SELECT * FROM "${this.tableName}" LIMIT $1 OFFSET $2;`,
      [limit, offset]
    );
    return res.rows.map(this.mapRow);
  }

  async find(filter: FilterQuery<T>): Promise<T[]> {
    const { whereClause, values } = this.buildWhereClause(filter);
    const query = `SELECT * FROM "${this.tableName}" ${whereClause};`;
    const res = await this.pool.query(query, values);
    return res.rows.map(this.mapRow);
  }

  async findOne(filter: FilterQuery<T>): Promise<T> {
    const { whereClause, values } = this.buildWhereClause(filter);
    const query = `SELECT * FROM "${this.tableName}" ${whereClause} LIMIT 1;`;
    const res = await this.pool.query(query, values);
    return this.mapRow(res.rows[0]);
  }

  async findById(id: string | Buffer): Promise<T> {
    const res = await this.pool.query(
      `SELECT * FROM "${this.tableName}" WHERE id = $1;`,
      [this.toIdString(id)]
    );
    return this.mapRow(res.rows[0]);
  }

  async update(
    id: string | Buffer,
    data: Partial<T>,
    options?: any
  ): Promise<T | null> {
    const keys = Object.keys(data);
    if (keys.length === 0) return this.findById(id);

    const setClause = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
    const values = [this.toIdString(id), ...Object.values(data)];

    const query = `UPDATE "${this.tableName}" SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *;`;
    const res = await this.pool.query(query, values);

    if (res.rowCount === 0 && options?.upsert) {
      return this.create({ ...data, id: this.toIdString(id) } as Partial<T>);
    }

    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: any
  ): Promise<T | null> {
    // Handling update operators like $set is complex.
    // We handle $set manually to support Mongoose-like syntax.
    const updateInput = update as any;
    let dataToUpdate = { ...updateInput };

    if (updateInput.$set) {
      dataToUpdate = { ...dataToUpdate, ...updateInput.$set };
      delete dataToUpdate.$set;
    }

    // First find matching
    const found = await this.findOne(filter);
    if (!found) {
      if (options?.upsert) {
        return this.create(dataToUpdate);
      }
      return null;
    }

    return this.update(this.toIdString(found.id)!, dataToUpdate, options);
  }

  async updateMany(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: any
  ): Promise<{ modifiedCount: number; upsertedCount: number }> {
    // Simplified implementation: find IDs, update loops. inefficient but safe for now.
    const items = await this.find(filter);
    let modifiedCount = 0;
    for (const item of items) {
      await this.update(this.toIdString(item.id!), update as any); // reusing logic
      modifiedCount++;
    }
    // Upsert logic for many is vague in mongo if 0 matches.
    return { modifiedCount, upsertedCount: 0 };
  }

  async delete(id: string | Buffer): Promise<T | null> {
    const res = await this.pool.query(
      `DELETE FROM "${this.tableName}" WHERE id = $1 RETURNING *;`,
      [this.toIdString(id)]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async deleteOne(filter: FilterQuery<T>): Promise<T | null> {
    const found = await this.findOne(filter);
    if (found) {
      return this.delete(this.toIdString(found.id!));
    }
    return null;
  }

  async deleteMany(filter: FilterQuery<T>): Promise<{ deletedCount: number }> {
    const { whereClause, values } = this.buildWhereClause(filter);
    const query = `DELETE FROM "${this.tableName}" ${whereClause};`;
    const res = await this.pool.query(query, values);
    return { deletedCount: res.rowCount || 0 };
  }

  async exists(filter: FilterQuery<T>): Promise<boolean> {
    const res = await this.findOne(filter);
    return !!res;
  }

  async countAll(): Promise<number> {
    const res = await this.pool.query(
      `SELECT COUNT(*) FROM "${this.tableName}";`
    );
    return parseInt(res.rows[0].count, 10);
  }

  async countWithFilter(filter: FilterQuery<T>): Promise<number> {
    const { whereClause, values } = this.buildWhereClause(filter);
    const query = `SELECT COUNT(*) FROM "${this.tableName}" ${whereClause};`;
    const res = await this.pool.query(query, values);
    return parseInt(res.rows[0].count, 10);
  }

  async aggregate(pipeline: any[]): Promise<any[]> {
    throw new Error(
      'Aggregation not fully supported in PostgresRepository yet'
    );
  }

  private mapRow(row: any): T {
    if (!row) return null as any;
    // Map created_at -> createdAt if needed, assuming T has camelCase
    // For now returning row as is, assuming keys match
    // Actually, postgres returns snake_case if we don't quote, but we quoted column creation
    // so they should be case sensitive.
    return row as T;
  }

  private buildWhereClause(filter: FilterQuery<T>): {
    whereClause: string;
    values: any[];
  } {
    if (!filter || Object.keys(filter as object).length === 0) {
      return { whereClause: '', values: [] };
    }

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Normalized filter is usually passed.
    for (const [key, value] of Object.entries(filter as Record<string, any>)) {
      if (key === '$or') {
        // value is array
        // not implemented
        continue;
      }

      if (key === 'id') {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const opObj = value as any;
          if (opObj.$in && Array.isArray(opObj.$in)) {
            const list = opObj.$in.map((v: any) => this.toIdString(v));
            conditions.push(`"id" = ANY($${idx++})`);
            values.push(list);
          } else if (opObj.$eq !== undefined) {
            conditions.push(`"id" = $${idx++}`);
            values.push(this.toIdString(opObj.$eq));
          } else if (opObj.$ne !== undefined) {
            conditions.push(`"id" <> $${idx++}`);
            values.push(this.toIdString(opObj.$ne));
          } else {
            // fallback equality if unrecognized operator
            conditions.push(`"id" = $${idx++}`);
            values.push(this.toIdString(opObj));
          }
        } else {
          conditions.push(`"id" = $${idx++}`);
          values.push(this.toIdString(value));
        }
      } else if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // basic operators for non-id fields can be added here
        // fallback unsupported: skip
      } else {
        // equality
        conditions.push(`"${key}" = $${idx++}`);
        values.push(value);
      }
    }

    if (conditions.length === 0) return { whereClause: '', values: [] };

    return {
      whereClause: 'WHERE ' + conditions.join(' AND '),
      values,
    };
  }

  private toIdString(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (value instanceof GenObjectId) {
      return value.toString();
    }
    if (Buffer.isBuffer(value)) {
      try {
        return GenObjectId.from(value).toString();
      } catch {
        return value.toString('hex');
      }
    }
    if (typeof value === 'string') {
      return value;
    }
    return String(value);
  }
}
