import { IsString, IsOptional } from 'class-validator';

export class CreateFilesystemTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
