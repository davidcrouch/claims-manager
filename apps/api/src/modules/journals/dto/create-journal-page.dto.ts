import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  IsDateString,
  IsArray,
  IsUUID,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class JournalPageBlockDto {
  @IsString()
  id!: string;

  @IsIn(['note', 'upload'])
  type!: 'note' | 'upload';

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsUUID()
  attachmentId?: string;
}

export class CreateJournalPageDto {
  @IsOptional()
  @IsString()
  name?: string;

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

  /** Ordered content blocks (notes + uploads). Stored in page metadata. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalPageBlockDto)
  blocks?: JournalPageBlockDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
