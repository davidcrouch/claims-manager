import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DOCUMENT_TYPES, type DocumentType } from '../types/document-types';

export class GenerateDocumentDto {
  @ApiProperty({
    enum: DOCUMENT_TYPES,
    description: 'The type of document to generate',
  })
  @IsEnum(DOCUMENT_TYPES)
  documentType: DocumentType;

  @ApiPropertyOptional({
    description:
      'Entity ID to generate for. Required for detail reports. List reports default to the tenant organisation.',
  })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Specific template assignment to use' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({
    description:
      'Filesystem .docx to use instead of the assigned template for this report type',
  })
  @IsOptional()
  @IsUUID()
  filesystemDocumentId?: string;

  @ApiPropertyOptional({
    description:
      'Company or job filesystem folder to save the generated PDF into. Omit to download only.',
  })
  @IsOptional()
  @IsUUID()
  destinationCategoryId?: string;

  @ApiPropertyOptional({
    description:
      'Related-entity slugs to include in the data context for this generation (overrides tenant defaults).',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledSlugs?: string[];
}
