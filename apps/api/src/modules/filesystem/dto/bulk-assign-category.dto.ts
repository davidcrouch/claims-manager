import { IsUUID, IsOptional, IsArray } from 'class-validator';

export class BulkAssignCategoryDto {
  @IsArray()
  @IsUUID('4', { each: true })
  documentIds!: string[];

  @IsOptional()
  @IsUUID()
  categoryId!: string | null;
}
