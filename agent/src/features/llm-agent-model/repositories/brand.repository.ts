import { MongooseRepository, Repository } from '@genesis/repository';
import { Connection } from 'mongoose';

export type Brand = {
  id: string;
  name: string;
  aliases?: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type BrandRepository = Repository<Brand>;

export function BrandRepositoryFactory(
  connection: Connection
): BrandRepository {
  return new MongooseRepository<Brand>(
    connection,
    'Brand',
    {
      name: { type: String, required: true },
      aliases: [String],
    },
    [[{ name: 1 }, { unique: true }], [{ createdAt: -1 }]]
  );
}
