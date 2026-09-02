import { IsArray, IsInt, IsObject, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
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
  @IsString()
  component?: string;

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
  component?: string;

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

  @IsOptional()
  @IsString()
  unitType?: string;

  @IsOptional()
  @IsString()
  lineScopeStatus?: string;
}

export class ComboUpdateDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  component?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  quantity?: string;

  @IsOptional()
  @IsString()
  lineScopeStatus?: string;
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

export class SortIndexEntryDto {
  @IsUUID()
  id!: string;

  @IsInt()
  @Min(0)
  sortIndex!: number;
}

export class ReorderLineItemsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SortIndexEntryDto)
  items?: SortIndexEntryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SortIndexEntryDto)
  combos?: SortIndexEntryDto[];
}

export class MoveLineItemDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  comboId?: string;

  @IsUUID()
  targetGroupId!: string;

  @IsOptional()
  @IsUUID()
  targetComboId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  insertAtIndex?: number;
}

export class DuplicateLineItemDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  comboId?: string;

  @IsUUID()
  targetGroupId!: string;

  @IsOptional()
  @IsUUID()
  targetComboId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  insertAtIndex?: number;
}
