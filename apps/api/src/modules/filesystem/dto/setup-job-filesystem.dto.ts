import { IsOptional, IsUUID } from 'class-validator';

export class SetupJobFilesystemDto {
  @IsOptional()
  @IsUUID()
  templateId?: string;
}
