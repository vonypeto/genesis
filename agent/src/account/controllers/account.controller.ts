import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AccountService } from '../services/account.service';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';
import { AccountStatus } from '../repositories/account.repository';

@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createAccountDto: CreateAccountDto) {
    const account = await this.accountService.create(createAccountDto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Account created successfully',
      data: account,
    };
  }

  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10'
  ) {
    const accounts = await this.accountService.findAll(
      parseInt(page),
      parseInt(limit)
    );
    const total = await this.accountService.countAll();

    return {
      statusCode: HttpStatus.OK,
      message: 'Accounts retrieved successfully',
      data: accounts,
      meta: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
      },
    };
  }

  @Get('search')
  async search(
    @Query('q') searchTerm: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10'
  ) {
    const accounts = await this.accountService.search(
      searchTerm,
      parseInt(page),
      parseInt(limit)
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Search results retrieved successfully',
      data: accounts,
    };
  }

  @Get('active')
  async findActive(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10'
  ) {
    const accounts = await this.accountService.findActiveAccounts(
      parseInt(page),
      parseInt(limit)
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Active accounts retrieved successfully',
      data: accounts,
    };
  }

  @Get('stats')
  async getStats() {
    const total = await this.accountService.countAll();
    const active = await this.accountService.countByStatus(
      AccountStatus.ACTIVE
    );
    const inactive = await this.accountService.countByStatus(
      AccountStatus.INACTIVE
    );
    const suspended = await this.accountService.countByStatus(
      AccountStatus.SUSPENDED
    );
    const pending = await this.accountService.countByStatus(
      AccountStatus.PENDING
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Account statistics retrieved successfully',
      data: {
        total,
        active,
        inactive,
        suspended,
        pending,
      },
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const account = await this.accountService.findById(id);

    if (!account) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Account not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Account retrieved successfully',
      data: account,
    };
  }

  @Get('email/:email')
  async findByEmail(@Param('email') email: string) {
    const account = await this.accountService.findByEmail(email);

    if (!account) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Account not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Account retrieved successfully',
      data: account,
    };
  }

  @Get('username/:username')
  async findByUsername(@Param('username') username: string) {
    const account = await this.accountService.findByUsername(username);

    if (!account) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Account not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Account retrieved successfully',
      data: account,
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAccountDto: UpdateAccountDto
  ) {
    const account = await this.accountService.update(id, updateAccountDto);

    if (!account) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Account not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Account updated successfully',
      data: account,
    };
  }

  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string) {
    const account = await this.accountService.activate(id);

    if (!account) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Account not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Account activated successfully',
      data: account,
    };
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string) {
    const account = await this.accountService.deactivate(id);

    if (!account) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Account not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Account deactivated successfully',
      data: account,
    };
  }

  @Patch(':id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspend(@Param('id') id: string) {
    const account = await this.accountService.suspend(id);

    if (!account) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Account not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Account suspended successfully',
      data: account,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    const account = await this.accountService.remove(id);

    if (!account) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Account not found',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Account deleted successfully',
      data: account,
    };
  }
}
