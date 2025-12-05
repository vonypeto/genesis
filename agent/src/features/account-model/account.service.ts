import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Tokens } from './libs/tokens';
import {
  Account,
  AccountRepository,
  AccountStatus,
  CreateAccountInput,
} from './repositories/account.repository';

@Injectable()
export class AccountService {
  constructor(
    @Inject(Tokens.AccountRepository)
    private accountRepository: AccountRepository
  ) {}

  async create(input: CreateAccountInput): Promise<Account> {
    const existingEmail = await this.accountRepository.findOne({
      email: input.email,
    });
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const existingUsername = await this.accountRepository.findOne({
      username: input.username,
    });

    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    return this.accountRepository.create({
      ...input,
      status: input.status || AccountStatus.ACTIVE,
      isActive: true,
      metadata: {},
    });
  }
  async findAll(page = 1, limit = 10): Promise<Account[]> {
    return this.accountRepository.findAll(page, limit);
  }
}
