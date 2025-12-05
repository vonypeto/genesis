import { Module } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { AccountService } from './account.service';
import { AccountController } from '../../app/controllers/account.controller';
import { Tokens } from './libs/tokens';
import { AccountRepositoryFactory } from './repositories/account.repository';

@Module({
  imports: [],
  controllers: [AccountController],
  providers: [
    {
      provide: Tokens.AccountRepository,
      useFactory: AccountRepositoryFactory,
      inject: [getConnectionToken()],
    },

    AccountService,
  ],
  exports: [AccountService, Tokens.AccountRepository],
})
export class AccountModule {}
