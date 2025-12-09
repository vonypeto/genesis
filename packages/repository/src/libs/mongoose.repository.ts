import {
  Connection,
  Schema,
  Model,
  Document,
  FilterQuery,
  UpdateQuery,
  Types,
} from 'mongoose';
import { Repository } from './types';
import { ObjectId } from '@genesis/object-id';

export class MongooseRepository<T> implements Repository<T> {
  protected model: Model<any>;

  constructor(
    connection: Connection,
    modelName: string,
    schemaDefinition: Record<string, any>,
    indexes?: Array<[Record<string, any>, Record<string, any>?]>
  ) {
    const schema = new Schema(schemaDefinition, {
      timestamps: true,
      collection: modelName.toLowerCase() + 's',
    });

    if (indexes) {
      indexes.forEach(([fields, options]) => {
        schema.index(fields, options || {});
      });
    }

    this.model = connection.model(modelName, schema);
  }

  async create(data: Partial<T>): Promise<T> {
    try {
      const payload = this.prepareData(data);
      const doc = new this.model(payload);
      const saved = await doc.save();
      return this.mapDocument(saved);
    } catch (error) {
      throw new Error(
        `Failed to create document: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async createMany(data: Partial<T>[]): Promise<T[]> {
    try {
      const payloads = data.map((d) => this.prepareData(d));
      const docs = await this.model.insertMany(payloads);
      return docs.map((doc) => this.mapDocument(doc));
    } catch (error) {
      throw new Error(
        `Failed to create documents: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async findAll(page: number = 1, limit: number = 10): Promise<T[]> {
    const skip = (page - 1) * limit;
    const docs = await this.model
      .find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
    return docs.map((doc) => this.mapDocument(doc));
  }

  async find(filter: FilterQuery<T>): Promise<T[]> {
    const docs = await this.model.find(this.normalizeFilter(filter)).exec();
    return docs.map((doc) => this.mapDocument(doc));
  }

  async findOne(filter: FilterQuery<T>): Promise<T> {
    const doc = await this.model.findOne(this.normalizeFilter(filter)).exec();
    return this.mapDocument(doc);
  }

  async findById(id: string | Buffer): Promise<T> {
    const normalizedId = this.toObjectId(id);
    const doc = await this.model.findById(normalizedId as any).exec();
    return this.mapDocument(doc);
  }

  async update(
    id: string | Buffer,
    data: Partial<T>,
    options?: { upsert?: boolean; new?: boolean; setDefaultsOnInsert?: boolean }
  ): Promise<T | null> {
    try {
      const normalizedId = this.toObjectId(id);
      const doc = await this.model
        .findByIdAndUpdate(normalizedId as any, data, { new: true, ...options })
        .exec();
      if (!doc && !options?.upsert) {
        throw new Error(`Document with id ${id} not found`);
      }
      return doc ? this.mapDocument(doc) : null;
    } catch (error) {
      throw new Error(
        `Failed to update document: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: { upsert?: boolean; new?: boolean; setDefaultsOnInsert?: boolean }
  ): Promise<T | null> {
    try {
      const doc = await this.model
        .findOneAndUpdate(this.normalizeFilter(filter), update, {
          new: true,
          ...options,
        })
        .exec();
      if (!doc && !options?.upsert) {
        throw new Error(`Document matching filter not found`);
      }
      return doc ? this.mapDocument(doc) : null;
    } catch (error) {
      throw new Error(
        `Failed to update document: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async updateMany(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: { upsert?: boolean }
  ): Promise<{ modifiedCount: number; upsertedCount: number }> {
    try {
      const result = await this.model
        .updateMany(this.normalizeFilter(filter), update, options)
        .exec();
      return {
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount || 0,
      };
    } catch (error) {
      throw new Error(
        `Failed to update documents: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async delete(id: string | Buffer): Promise<T | null> {
    try {
      const normalizedId = this.toObjectId(id);
      const doc = await this.model
        .findByIdAndDelete(normalizedId as any)
        .exec();
      if (!doc) {
        throw new Error(`Document with id ${id} not found`);
      }
      return this.mapDocument(doc);
    } catch (error) {
      throw new Error(
        `Failed to delete document: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async deleteOne(filter: FilterQuery<T>): Promise<T | null> {
    try {
      const doc = await this.model
        .findOneAndDelete(this.normalizeFilter(filter))
        .exec();
      if (!doc) {
        throw new Error(`Document matching filter not found`);
      }
      return this.mapDocument(doc);
    } catch (error) {
      throw new Error(
        `Failed to delete document: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async deleteMany(filter: FilterQuery<T>): Promise<{ deletedCount: number }> {
    try {
      const result = await this.model
        .deleteMany(this.normalizeFilter(filter))
        .exec();
      return { deletedCount: result.deletedCount };
    } catch (error) {
      throw new Error(
        `Failed to delete documents: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async exists(filter: FilterQuery<T>): Promise<boolean> {
    const count = await this.model
      .countDocuments(this.normalizeFilter(filter))
      .limit(1)
      .exec();
    return count > 0;
  }

  async countAll(): Promise<number> {
    return this.model.countDocuments().exec();
  }

  async countWithFilter(filter: FilterQuery<T>): Promise<number> {
    return this.model.countDocuments(this.normalizeFilter(filter)).exec();
  }

  async aggregate(pipeline: any[]): Promise<any[]> {
    return this.model.aggregate(pipeline).exec();
  }

  private normalizeFilter(filter: FilterQuery<T>): FilterQuery<T> {
    if (!filter || typeof filter !== 'object') return filter;
    const cloned: Record<string, unknown> = {
      ...(filter as Record<string, unknown>),
    };
    if ('id' in cloned) {
      const idVal = cloned['id'];
      delete cloned['id'];
      cloned['_id'] = this.normalizeIdOperator(idVal);
    }
    return cloned as FilterQuery<T>;
  }

  private normalizeIdOperator(value: unknown): unknown {
    if (value instanceof ObjectId) {
      return value.buffer;
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.toObjectId(v));
    }
    if (value && typeof value === 'object') {
      const inObj = value as Record<string, unknown>;
      const outObj: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(inObj)) {
        if (key === '$in' || key === '$nin') {
          outObj[key] = Array.isArray(val)
            ? (val as unknown[]).map((v) => this.toObjectId(v))
            : val;
        } else if (key === '$eq' || key === '$ne') {
          outObj[key] = this.toObjectId(val);
        } else {
          outObj[key] = val;
        }
      }
      return outObj;
    }
    return this.toObjectId(value);
  }

  private toObjectId(value: unknown): unknown {
    if (value instanceof ObjectId) {
      return value.buffer;
    }
    if (typeof value === 'string') {
      // Hex string for Mongo ObjectId
      if (/^[a-fA-F0-9]{24}$/.test(value)) {
        return new Types.ObjectId(value);
      }
      // Try base58 (genesis) id -> buffer
      try {
        const parsed = ObjectId.from(value as string);
        return parsed.buffer;
      } catch (_) {
        // not a base58 id; fall through
      }
    }
    if (value instanceof Buffer) {
      // If 12 bytes, Mongoose can interpret as ObjectId; otherwise treat as Buffer (e.g., 16-byte genesis ID)
      return value.length === 12 ? new Types.ObjectId(value) : value;
    }
    return value;
  }

  protected mapDocument(doc: Document | null): T {
    if (!doc) {
      return null as unknown as T;
    }
    const obj = doc.toObject();

    if (obj._id !== undefined) {
      // Convert to friendly id string
      const rawId = obj._id;
      if (rawId instanceof Types.ObjectId) {
        obj.id = rawId.toHexString();
      } else if (Buffer.isBuffer(rawId)) {
        try {
          obj.id = ObjectId.from(rawId).toString();
        } catch (_) {
          obj.id = rawId;
        }
      } else {
        obj.id = rawId;
      }
      delete obj._id;
    }
    return obj as T;
  }

  private prepareData(data: Partial<T>): Partial<T> {
    const payload: any = { ...(data as any) };
    if ('id' in payload && payload.id !== undefined) {
      const normalized = this.toObjectId(payload.id);
      delete payload.id;
      payload._id = normalized;
    }
    return payload as Partial<T>;
  }
}
