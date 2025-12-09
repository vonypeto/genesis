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
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Inject } from '@nestjs/common';
import { AccountService } from '../../features/account-model/account.service';
import { Account } from '../../features/account-model/repositories/account.repository';
import { CreateAccountDto } from '../../libs/dtos';
import { AsyncEventDispatcherService } from '@genesis/async-event-module';
import R from 'ramda';
import { Buffer } from 'buffer';
import { Types, Schema } from 'mongoose';
import { delay } from 'rxjs';
import { Idempotency } from '../interceptor/idempotency';
import Redis from 'ioredis';
import Redlock from 'redlock';
import { Joser } from '@scaleforge/joser';
import { Tokens } from '../../libs/tokens';
import { AppRequest } from '../../libs/types';
import { ObjectId } from '@genesis/object-id';

@Controller('accounts')
export class AccountController {
  constructor(
    private readonly accountService: AccountService,
    private readonly dispatcher: AsyncEventDispatcherService,
    @Inject(Tokens.Redis)
    private readonly redis: Redis,
    @Inject(Tokens.Redlock)
    private readonly redlock: Redlock,
    private readonly joser: Joser
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  // @Idempotency((input: CreateAccountDto) => <string>input['email'])
  async create(@Body() input: CreateAccountDto): Promise<boolean> {
    console.log('AccountController.create called with input:', input);

    console.log(
      await this.accountService.findById(ObjectId.from('CVuTq153WeGxiH2WjXQwT'))
    );
    await this.dispatcher.dispatch(
      ['agent'],
      {
        id: ObjectId.generate(),
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

    // await this.accountService.create(input);
    return true;
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
