import { Injectable } from '@nestjs/common';
import mongoose from 'mongoose';

@Injectable()
export class MongooseTestService {
  async testMongoose() {
    // Test that mongoose is properly imported and typed
    const schema = new mongoose.Schema({
      name: String,
      email: String,
      createdAt: { type: Date, default: Date.now },
    });

    const User = mongoose.model('User', schema);

    return {
      message: 'Mongoose is working!',
      mongooseVersion: mongoose.version,
      modelName: User.modelName,
    };
  }
}
