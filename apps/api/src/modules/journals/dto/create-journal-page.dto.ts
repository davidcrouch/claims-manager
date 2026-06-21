import { IsString, IsOptional, IsNumber, IsIn, IsDateString } from 'class-validator';

export class CreateJournalPageDto {
  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsIn(['plaintext', 'markdown', 'html'])
  bodyFormat?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  locationAccuracy?: number;

  @IsOptional()
  @IsString()
  locationLabel?: string;

  @IsOptional()
  @IsDateString()
  capturedAt?: string;
}
