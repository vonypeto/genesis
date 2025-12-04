import { Injectable } from '@nestjs/common';
import { Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import {
  Account,
  AccountRepository,
  AccountRepositoryFactory,
  AccountStatus,
} from '../repositories/account.repository';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AccountService {
  private readonly accountRepository: AccountRepository;

  constructor(@InjectConnection() private connection: Connection) {
    this.accountRepository = AccountRepositoryFactory(this.connection);
  }

  /**
   * Create a new account
   */
  async create(createAccountDto: CreateAccountDto): Promise<Account> {
    // Hash password
    const hashedPassword = await bcrypt.hash(createAccountDto.password, 10);

    const accountData: Partial<Account> = {
      ...createAccountDto,
      password: hashedPassword,
      status: AccountStatus.ACTIVE,
      isActive: true,
      metadata: {},
    };

    return this.accountRepository.create(accountData);
  }

  /**
   * Find all accounts with pagination
   */
  async findAll(page: number = 1, limit: number = 10): Promise<Account[]> {
    return this.accountRepository.findAll(page, limit);
  }

  /**
   * Find account by ID
   */
  async findById(id: string): Promise<Account | null> {
    return this.accountRepository.findById(id);
  }

  /**
   * Find account by email
   */
  async findByEmail(email: string): Promise<Account | null> {
    return this.accountRepository.findOne({ email } as any);
  }

  /**
   * Find account by username
   */
  async findByUsername(username: string): Promise<Account | null> {
    return this.accountRepository.findOne({ username } as any);
  }

  /**
   * Find active accounts
   */
  async findActiveAccounts(
    page: number = 1,
    limit: number = 10
  ): Promise<Account[]> {
    return this.accountRepository.findAll(page, limit);
  }

  /**
   * Update account
   */
  async update(
    id: string,
    updateAccountDto: UpdateAccountDto
  ): Promise<Account | null> {
    const updateData: Partial<Account> = { ...updateAccountDto };

    // Hash password if provided
    if (updateAccountDto.password) {
      updateData.password = await bcrypt.hash(updateAccountDto.password, 10);
    }

    return this.accountRepository.update(id, updateData);
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<Account | null> {
    return this.accountRepository.update(id, {
      lastLoginAt: new Date(),
    } as any);
  }

  /**
   * Deactivate account
   */
  async deactivate(id: string): Promise<Account | null> {
    return this.accountRepository.update(id, {
      isActive: false,
      status: AccountStatus.INACTIVE,
    } as any);
  }

  /**
   * Activate account
   */
  async activate(id: string): Promise<Account | null> {
    return this.accountRepository.update(id, {
      isActive: true,
      status: AccountStatus.ACTIVE,
    } as any);
  }

  /**
   * Suspend account
   */
  async suspend(id: string): Promise<Account | null> {
    return this.accountRepository.update(id, {
      status: AccountStatus.SUSPENDED,
    } as any);
  }

  /**
   * Delete account
   */
  async remove(id: string): Promise<Account | null> {
    return this.accountRepository.delete(id);
  }

  /**
   * Count all accounts
   */
  async countAll(): Promise<number> {
    return this.accountRepository.countAll();
  }

  /**
   * Count accounts by status
   */
  async countByStatus(status: AccountStatus): Promise<number> {
    return this.accountRepository.countWithFilter({ status } as any);
  }

  /**
   * Check if account exists by email
   */
  async existsByEmail(email: string): Promise<boolean> {
    return this.accountRepository.exists({ email } as any);
  }

  /**
   * Check if account exists by username
   */
  async existsByUsername(username: string): Promise<boolean> {
    return this.accountRepository.exists({ username } as any);
  }

  /**
   * Verify password
   */
  async verifyPassword(
    plainPassword: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Search accounts
   */
  async search(
    searchTerm: string,
    page: number = 1,
    limit: number = 10
  ): Promise<Account[]> {
    const pipeline = [
      {
        $match: {
          $or: [
            { email: { $regex: searchTerm, $options: 'i' } },
            { username: { $regex: searchTerm, $options: 'i' } },
            { firstName: { $regex: searchTerm, $options: 'i' } },
            { lastName: { $regex: searchTerm, $options: 'i' } },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];

    return this.accountRepository.aggregate(pipeline);
  }
}
