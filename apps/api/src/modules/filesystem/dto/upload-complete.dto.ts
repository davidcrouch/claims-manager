import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UploadCompleteDto {
  @IsUUID()
  documentId!: string;

  @IsOptional()
  @IsString()
  thumbnailObjectPath?: string;
}
