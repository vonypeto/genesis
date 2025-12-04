import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountService } from './services/account.service';
import { AccountController } from './controllers/account.controller';

@Module({
  imports: [MongooseModule.forFeature([])],
  controllers: [AccountController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
