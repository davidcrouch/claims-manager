import { IsString, MinLength } from 'class-validator';

export class UpdateFeedbackNoteDto {
  @IsString()
  @MinLength(1)
  body!: string;
}
