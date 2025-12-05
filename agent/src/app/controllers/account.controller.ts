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

@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createAccountDto: CreateAccountDto): Promise<Account> {
    return this.accountService.create(createAccountDto);
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
