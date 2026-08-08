import { IsString, IsOptional, IsNumber, IsInt, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePageAttachmentDto {
  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fileSize?: number;

  @IsString()
  storageKey!: string;

  @IsOptional()
  @IsUUID()
  documentId?: string;

  @IsOptional()
  @IsString()
  thumbnailStorageKey?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortIndex?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  durationSeconds?: number;
}
