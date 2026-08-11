import { IsString, IsOptional, IsObject } from 'class-validator';

export class UpdateAssessmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  jobId?: string;

  @IsOptional()
  @IsObject()
  attendance?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  building?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  habitability?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  hazards?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  damage?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  makeSafe?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  temporaryAccommodation?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  specialists?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  recommendation?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  extras?: Record<string, unknown>;
}
