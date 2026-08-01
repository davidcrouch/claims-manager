import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DOCUMENT_TYPES, type DocumentType } from '../types/document-types';

export class GenerateDocumentDto {
  @ApiProperty({
    enum: DOCUMENT_TYPES,
    description: 'The type of document to generate',
  })
  @IsEnum(DOCUMENT_TYPES)
  documentType: DocumentType;

  @ApiProperty({ description: 'The ID of the entity to generate a document for' })
  @IsUUID()
  entityId: string;

  @ApiPropertyOptional({ description: 'Specific template to use (defaults to the tenant default)' })
  @IsOptional()
  @IsUUID()
  templateId?: string;
}
