import { MongooseRepository, Repository } from '@genesis/repository';
import { Connection } from 'mongoose';

export type Prompt = {
  id: string;
  text: string;
  category?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type PromptRepository = Repository<Prompt>;

export function PromptRepositoryFactory(
  connection: Connection
): PromptRepository {
  return new MongooseRepository<Prompt>(
    connection,
    'Prompt',
    {
      text: { type: String, required: true },
      category: String,
      tags: [String],
    },
    [[{ text: 1 }, { unique: true }], [{ createdAt: -1 }]]
  );
}
