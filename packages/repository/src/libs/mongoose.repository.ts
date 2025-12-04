import {
  Connection,
  Schema,
  Model,
  Document,
  FilterQuery,
  UpdateQuery,
} from 'mongoose';

export interface Repository<T> {
  create(data: Partial<T>): Promise<T>;
  createMany(data: Partial<T>[]): Promise<T[]>;
  findAll(page?: number, limit?: number): Promise<T[]>;
  findOne(filter: FilterQuery<T>): Promise<T | null>;
  findById(id: string | Buffer): Promise<T | null>;
  update(id: string | Buffer, data: Partial<T>): Promise<T | null>;
  updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<T | null>;
  updateMany(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>
  ): Promise<{ modifiedCount: number }>;
  delete(id: string | Buffer): Promise<T | null>;
  deleteOne(filter: FilterQuery<T>): Promise<T | null>;
  deleteMany(filter: FilterQuery<T>): Promise<{ deletedCount: number }>;
  exists(filter: FilterQuery<T>): Promise<boolean>;
  countAll(): Promise<number>;
  countWithFilter(filter: FilterQuery<T>): Promise<number>;
  aggregate(pipeline: any[]): Promise<any[]>;
}

export class MongooseRepository<T> implements Repository<T> {
  protected model: Model<Document>;

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

    // Add indexes if provided
    if (indexes) {
      indexes.forEach(([fields, options]) => {
        schema.index(fields, options || {});
      });
    }

    this.model = connection.model(modelName, schema);
  }

  async create(data: Partial<T>): Promise<T> {
    const doc = new this.model(data);
    const saved = await doc.save();
    return this.mapDocument(saved);
  }

  async createMany(data: Partial<T>[]): Promise<T[]> {
    const docs = await this.model.insertMany(data);
    return docs.map((doc) => this.mapDocument(doc));
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

  async update(id: string | Buffer, data: Partial<T>): Promise<T | null> {
    const doc = await this.model
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
    return doc ? this.mapDocument(doc) : null;
  }

  async updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>
  ): Promise<T | null> {
    const doc = await this.model
      .findOneAndUpdate(filter, update, { new: true })
      .exec();
    return doc ? this.mapDocument(doc) : null;
  }

  async updateMany(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>
  ): Promise<{ modifiedCount: number }> {
    const result = await this.model.updateMany(filter, update).exec();
    return { modifiedCount: result.modifiedCount };
  }

  async delete(id: string | Buffer): Promise<T | null> {
    const doc = await this.model.findByIdAndDelete(id).exec();
    return doc ? this.mapDocument(doc) : null;
  }

  async deleteOne(filter: FilterQuery<T>): Promise<T | null> {
    const doc = await this.model.findOneAndDelete(filter).exec();
    return doc ? this.mapDocument(doc) : null;
  }

  async deleteMany(filter: FilterQuery<T>): Promise<{ deletedCount: number }> {
    const result = await this.model.deleteMany(filter).exec();
    return { deletedCount: result.deletedCount };
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

  /**
   * Map Mongoose document to plain object
   * Override this method to customize the mapping
   */
  protected mapDocument(doc: Document): T {
    const obj = doc.toObject();
    // Convert _id to id
    if (obj._id) {
      obj.id = obj._id;
      delete obj._id;
    }
    return obj as T;
  }
}
