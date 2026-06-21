import {
  IsUUID,
  IsOptional,
  IsObject,
  IsString,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class CreateJobDto {
  @IsUUID()
  claimId: string;

  @IsUUID()
  jobTypeLookupId: string;

  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsUUID()
  statusLookupId?: string;

  @IsOptional()
  @IsUUID()
  parentJobId?: string;

  @IsOptional()
  @IsObject()
  address?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  requestDate?: string;

  @IsOptional()
  @IsBoolean()
  collectExcess?: boolean;

  @IsOptional()
  @IsNumber()
  excess?: number;

  @IsOptional()
  @IsBoolean()
  makeSafeRequired?: boolean;

  @IsOptional()
  @IsString()
  jobInstructions?: string;
}
