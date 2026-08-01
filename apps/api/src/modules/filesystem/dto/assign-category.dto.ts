import { IsUUID, IsOptional } from 'class-validator';

export class AssignCategoryDto {
  @IsOptional()
  @IsUUID()
  categoryId!: string | null;
}
