import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class EnsureUserContactDto {
  @IsUUID()
  tenantId!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  name?: string;
}
