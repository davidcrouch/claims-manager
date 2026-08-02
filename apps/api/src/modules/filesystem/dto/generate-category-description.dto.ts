import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SiblingCategoryDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}

export class GenerateCategoryDescriptionDto {
  @IsString()
  categoryName!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SiblingCategoryDto)
  siblingCategories!: SiblingCategoryDto[];
}
