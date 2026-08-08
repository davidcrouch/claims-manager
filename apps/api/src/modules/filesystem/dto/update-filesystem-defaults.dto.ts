import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class UpdateFilesystemDefaultsDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  defaultCompanyTemplateId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  defaultProjectTemplateId?: string | null;
}
