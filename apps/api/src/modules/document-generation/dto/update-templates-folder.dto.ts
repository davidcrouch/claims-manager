import { IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTemplatesFolderDto {
  @ApiPropertyOptional({
    description:
      'Company filesystem category ID where generation templates live. Null clears the setting.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  filesystemCategoryId?: string | null;
}
