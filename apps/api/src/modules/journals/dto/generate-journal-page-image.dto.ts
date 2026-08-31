import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateJournalPageImageDto {
  @IsString()
  @MaxLength(1000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  caption?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fileName?: string;
}
