import { IsString, IsOptional, IsNumber, IsInt } from 'class-validator';

export class CreatePageAttachmentDto {
  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsOptional()
  @IsInt()
  fileSize?: number;

  @IsString()
  storageKey!: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsInt()
  width?: number;

  @IsOptional()
  @IsInt()
  height?: number;

  @IsOptional()
  @IsNumber()
  durationSeconds?: number;
}
