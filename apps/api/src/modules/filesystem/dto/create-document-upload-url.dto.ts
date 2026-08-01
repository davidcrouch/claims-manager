import { IsString, IsOptional, IsUUID, IsNumber } from 'class-validator';

export class CreateDocumentUploadUrlDto {
  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsOptional()
  @IsNumber()
  fileSizeBytes?: number;

  @IsOptional()
  @IsString()
  relatedRecordType?: string;

  @IsOptional()
  @IsUUID()
  relatedRecordId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
