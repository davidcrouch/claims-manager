import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const JOURNAL_SITE_ENTRY_KINDS = [
  'intro',
  'pre_existing',
  'observation',
  'scope_of_work',
  'damage',
  'recommendation',
  'other',
] as const;

export type JournalSiteEntryKind = (typeof JOURNAL_SITE_ENTRY_KINDS)[number];

export class JournalSiteEntryImageDto {
  /** Prompt describing the inspection photo to generate. */
  @IsString()
  @MaxLength(1000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  caption?: string;
}

export class CreateJournalSiteEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsIn([...JOURNAL_SITE_ENTRY_KINDS])
  entryKind?: JournalSiteEntryKind;

  /** Spoken inspector narrative (what was seen). No headings or labels. */
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  observation?: string;

  /** Optional spoken aside about likely repair. Stored as a plain note, not a heading. */
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  scopeOfWork?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(8000, { each: true })
  additionalNotes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => JournalSiteEntryImageDto)
  images?: JournalSiteEntryImageDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  locationLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsDateString()
  capturedAt?: string;

  /** Existing document UUIDs (from the project filesystem) to attach to this entry. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  documentIds?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
