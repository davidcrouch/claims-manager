import { IsUUID } from 'class-validator';

export class UploadCompleteDto {
  @IsUUID()
  documentId!: string;
}
