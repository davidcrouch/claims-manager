import { IsUUID } from 'class-validator';

export class SetupFilesystemDto {
  @IsUUID()
  templateId!: string;
}
