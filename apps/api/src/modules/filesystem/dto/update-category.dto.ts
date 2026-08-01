import { IsString, IsOptional, IsNumber, IsObject } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
