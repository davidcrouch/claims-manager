import { IsArray, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateQuoteGroupDto {
  @IsOptional()
  @IsUUID()
  groupLabelLookupId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateQuoteGroupDto {
  @IsOptional()
  @IsUUID()
  groupLabelLookupId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  dimensions?: Record<string, unknown>;
}

export class ReorderQuoteGroupsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  groupIds!: string[];
}
