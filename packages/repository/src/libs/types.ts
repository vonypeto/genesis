import { FilterQuery, UpdateQuery } from 'mongoose';

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
