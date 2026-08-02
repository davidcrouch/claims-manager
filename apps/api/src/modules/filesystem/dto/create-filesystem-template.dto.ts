import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateFilesystemTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** company = org filesystem; project = per-job filesystem. */
  @IsOptional()
  @IsIn(['company', 'project'])
  kind?: 'company' | 'project';
}
