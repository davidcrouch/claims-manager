import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AssignTemplateDto {
  @ApiPropertyOptional({
    description: 'Filesystem document ID of the .docx template. Omit or null to clear.',
  })
  @IsOptional()
  @IsUUID()
  filesystemDocumentId?: string | null;
}
