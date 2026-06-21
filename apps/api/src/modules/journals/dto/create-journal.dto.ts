import { IsString, IsOptional, IsNumber, IsObject } from 'class-validator';

export class CreateJournalDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

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
