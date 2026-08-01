import { IsString, IsOptional, IsUUID, IsNumber, IsObject, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReplaceCategoryItem {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsUUID()
  parentCategoryId?: string;

  @IsString()
  displayName!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class ReplaceCategoriesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReplaceCategoryItem)
  categories!: ReplaceCategoryItem[];
}
