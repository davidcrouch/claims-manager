import { IsString, IsOptional } from 'class-validator';

export class UpdateFilesystemTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
