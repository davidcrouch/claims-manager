import { IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DOCUMENT_TYPES, type DocumentType } from '../types/document-types';

export class UploadTemplateDto {
  @ApiProperty({
    enum: DOCUMENT_TYPES,
    description: 'The document type this template is for',
  })
  @IsEnum(DOCUMENT_TYPES)
  documentType: DocumentType;

  @ApiProperty({ description: 'Human-readable template name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Set as the default template for this type',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
