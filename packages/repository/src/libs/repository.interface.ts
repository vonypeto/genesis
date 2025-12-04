import mongoose, { Document, FilterQuery, UpdateQuery } from 'mongoose';

export interface IRepository<T extends Document> {
  create(data: Partial<T>): Promise<T>;
  createMany(data: Partial<T>[]): Promise<T[]>;
  findAll(page?: number, limit?: number): Promise<T[]>;
  findAllWithFilter(
    filter: FilterQuery<T>,
    page?: number,
    limit?: number
  ): Promise<T[]>;
  findOne(filter: FilterQuery<T>): Promise<T | null>;
  findById(_id: mongoose.Types.ObjectId | string): Promise<T | null>;
  countAll(): Promise<number>;
  countWithFilter(filter: FilterQuery<T>): Promise<number>;
  update(
    _id: mongoose.Types.ObjectId | string,
    data: Partial<T>
  ): Promise<T | null>;
  updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<T | null>;
  updateMany(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>
  ): Promise<{ modifiedCount: number }>;
  delete(_id: mongoose.Types.ObjectId | string): Promise<T | null>;
  deleteOne(filter: FilterQuery<T>): Promise<T | null>;
  deleteMany(filter: FilterQuery<T>): Promise<{ deletedCount: number }>;
  exists(filter: FilterQuery<T>): Promise<boolean>;
  aggregate(pipeline: any[]): Promise<any[]>;
}
