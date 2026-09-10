import { IsString, MinLength } from 'class-validator';

export class CreateFeedbackNoteDto {
  @IsString()
  @MinLength(1)
  body!: string;
}
