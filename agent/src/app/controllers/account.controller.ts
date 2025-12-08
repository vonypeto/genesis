import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AccountService } from '../../features/account-model/account.service';
import { Account } from '../../features/account-model/repositories/account.repository';
import { CreateAccountDto } from '../../libs/dtos';
import { AsyncEventDispatcherService } from '@genesis/async-event-module';
import R from 'ramda';
import { Buffer } from 'buffer';
import { Types, Schema } from 'mongoose';
import { delay } from 'rxjs';

@Controller('accounts')
export class AccountController {
  constructor(
    private readonly accountService: AccountService,
    private readonly dispatcher: AsyncEventDispatcherService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() input: CreateAccountDto): Promise<boolean> {
    await this.dispatcher.dispatch(
      ['agent'],
      {
        id: Buffer.from(new Types.ObjectId().toHexString(), 'hex'),
        type: 'MemberAccountCreated',
        payload: {
          ...R.pick(['email'], input),
        },
        timestamp: new Date(),
      },
      {
        category: 'HIGH',
        delay: 5000,
      }
    );

    return true;
    // return this.accountService.create(input);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ): Promise<Account[]> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.accountService.findAll(pageNum, limitNum);
  }
}
