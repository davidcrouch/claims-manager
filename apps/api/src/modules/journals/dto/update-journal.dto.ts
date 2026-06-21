import { IsString, IsOptional, IsNumber, IsObject, IsIn } from 'class-validator';

export class UpdateJournalDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['active', 'archived', 'deleted'])
  status?: string;

  @IsOptional()
  @IsObject()
  address?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
