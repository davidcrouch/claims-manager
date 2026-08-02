import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateFilesystemTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['company', 'project'])
  kind?: 'company' | 'project';
}
