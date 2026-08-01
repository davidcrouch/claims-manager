import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateDocumentUploadUrlDto } from './create-document-upload-url.dto';

export class BatchUploadUrlsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDocumentUploadUrlDto)
  files!: CreateDocumentUploadUrlDto[];
}
