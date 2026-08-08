import {
  IsUUID,
  IsOptional,
  IsObject,
  IsString,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateJobContactDto {
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  mobilePhone?: string;

  @IsOptional()
  @IsString()
  homePhone?: string;

  @IsOptional()
  @IsString()
  workPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateJobDto {
  @IsOptional()
  @IsUUID()
  claimId?: string;

  @IsUUID()
  jobTypeLookupId: string;

  @IsOptional()
  @IsString()
  name?: string;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJobContactDto)
  contacts?: CreateJobContactDto[];

  /** Project filesystem template (kind=project). Falls back to org default. */
  @IsOptional()
  @IsUUID()
  filesystemTemplateId?: string;
}
