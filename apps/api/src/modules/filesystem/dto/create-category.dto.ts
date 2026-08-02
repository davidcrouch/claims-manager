import { IsString, IsOptional, IsUUID, IsNumber, IsObject } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  displayName!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID()
  parentCategoryId?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
