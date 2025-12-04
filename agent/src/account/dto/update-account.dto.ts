import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateAccountDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsEnum(['active', 'inactive', 'suspended'])
  @IsOptional()
  status?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
