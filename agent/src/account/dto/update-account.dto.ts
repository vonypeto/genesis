import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AccountStatus } from '../repositories/account.repository';

export class UpdateAccountDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsEnum(AccountStatus)
  @IsOptional()
  status?: AccountStatus;

  @IsOptional()
  metadata?: Record<string, any>;
}
