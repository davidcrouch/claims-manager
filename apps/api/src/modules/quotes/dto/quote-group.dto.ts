import { IsArray, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

export class LineItemUpdateDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  quantity?: string;

  @IsOptional()
  @IsString()
  unitCost?: string;

  @IsOptional()
  @IsString()
  markupValue?: string;

  @IsOptional()
  @IsString()
  tax?: string;
}

export class ComboUpdateDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  quantity?: string;
}

export class UpdateQuoteLineItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemUpdateDto)
  items!: LineItemUpdateDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboUpdateDto)
  combos!: ComboUpdateDto[];
}
