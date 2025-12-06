import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PostgresAccountService } from '../../features/postgres-account-model/postgres-account.service';
import { PostgresAccount } from '../../features/postgres-account-model/repositories/postgres-account.repository';
import { CreateAccountDto } from '../../libs/dtos'; // Reusing DTO for simplicity as structure matches

@Controller('postgres-accounts')
export class PostgresAccountController {
  constructor(private readonly accountService: PostgresAccountService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createAccountDto: CreateAccountDto
  ): Promise<PostgresAccount> {
    return this.accountService.create({
      ...createAccountDto,
    });
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ): Promise<PostgresAccount[]> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.accountService.findAll(pageNum, limitNum);
  }
}
