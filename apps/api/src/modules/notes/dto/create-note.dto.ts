import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateNoteDto {
  @IsUUID()
  jobId!: string;

  @IsString()
  @MinLength(1)
  body!: string;
}
