import { MongooseRepository, Repository } from '@genesis/repository';
import { Connection, Schema } from 'mongoose';

export type BrandMention = {
  id: string;
  responseId: string;
  brandId: string;
  mentioned: boolean;
  positionIndex?: number;
  mentionCount: number;
  context?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type BrandMentionRepository = Repository<BrandMention>;

export function BrandMentionRepositoryFactory(
  connection: Connection
): BrandMentionRepository {
  return new MongooseRepository<BrandMention>(
    connection,
    'BrandMention',
    {
      responseId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'Response',
      },
      brandId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'Brand',
      },
      mentioned: { type: Boolean, required: true },
      positionIndex: Number,
      mentionCount: { type: Number, default: 0 },
      context: String,
    },
    [
      [{ responseId: 1 }],
      [{ brandId: 1 }],
      [{ responseId: 1, brandId: 1 }, { unique: true }],
      [{ brandId: 1, mentioned: 1 }],
    ]
  );
}
