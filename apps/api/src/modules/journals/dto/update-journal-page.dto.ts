import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

export class UpdateJournalPageDto {
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
}
