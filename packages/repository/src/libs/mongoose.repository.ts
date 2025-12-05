import {
  Connection,
  Schema,
  Model,
  Document,
  FilterQuery,
  UpdateQuery,
} from 'mongoose';
import { Repository } from './types';

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
      const doc = new this.model(data);
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
      const docs = await this.model.insertMany(data);
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

  async findOne(filter: FilterQuery<T>): Promise<T | null> {
    const doc = await this.model.findOne(filter).exec();
    return doc ? this.mapDocument(doc) : null;
  }

  async findById(id: string | Buffer): Promise<T | null> {
    const doc = await this.model.findById(id).exec();
    return doc ? this.mapDocument(doc) : null;
  }

  async update(
    id: string | Buffer,
    data: Partial<T>,
    options?: { upsert?: boolean; new?: boolean; setDefaultsOnInsert?: boolean }
  ): Promise<T | null> {
    try {
      const doc = await this.model
        .findByIdAndUpdate(id, data, { new: true, ...options })
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
        .findOneAndUpdate(filter, update, { new: true, ...options })
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
        .updateMany(filter, update, options)
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
      const doc = await this.model.findByIdAndDelete(id).exec();
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
      const doc = await this.model.findOneAndDelete(filter).exec();
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
      const result = await this.model.deleteMany(filter).exec();
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
    const count = await this.model.countDocuments(filter).limit(1).exec();
    return count > 0;
  }

  async countAll(): Promise<number> {
    return this.model.countDocuments().exec();
  }

  async countWithFilter(filter: FilterQuery<T>): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  async aggregate(pipeline: any[]): Promise<any[]> {
    return this.model.aggregate(pipeline).exec();
  }

  protected mapDocument(doc: Document): T {
    const obj = doc.toObject();

    if (obj._id) {
      obj.id = obj._id;
      delete obj._id;
    }
    return obj as T;
  }
}
