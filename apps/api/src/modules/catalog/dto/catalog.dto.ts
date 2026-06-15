import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCatalogTypeDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortIndex?: number;
}

export class UpdateCatalogTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortIndex?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateCatalogCategoryDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  parentCategoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortIndex?: number;
}

export class UpdateCatalogCategoryDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  parentCategoryId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortIndex?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateCatalogItemDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['primitive', 'assembly'])
  kind!: 'primitive' | 'assembly';

  @IsUUID()
  typeId!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  subCategoryId?: string;

  @IsOptional()
  @IsUUID()
  unitTypeLookupId?: string;

  @IsOptional()
  @IsString()
  unitCost?: string;

  @IsOptional()
  @IsString()
  buyCost?: string;

  @IsOptional()
  @IsString()
  markupType?: string;

  @IsOptional()
  @IsString()
  markupValue?: string;

  @IsOptional()
  @IsString()
  taxRate?: string;

  @IsOptional()
  @IsIn(['computed', 'fixed', 'cost_plus'])
  pricingMode?: 'computed' | 'fixed' | 'cost_plus';

  @IsOptional()
  @IsString()
  fixedUnitCost?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  effectiveTo?: string;
}

export class UpdateCatalogItemDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  typeId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsUUID()
  subCategoryId?: string | null;

  @IsOptional()
  @IsUUID()
  unitTypeLookupId?: string;

  @IsOptional()
  @IsString()
  unitCost?: string;

  @IsOptional()
  @IsString()
  buyCost?: string;

  @IsOptional()
  @IsString()
  markupType?: string;

  @IsOptional()
  @IsString()
  markupValue?: string;

  @IsOptional()
  @IsString()
  taxRate?: string;

  @IsOptional()
  @IsIn(['computed', 'fixed', 'cost_plus'])
  pricingMode?: 'computed' | 'fixed' | 'cost_plus';

  @IsOptional()
  @IsString()
  fixedUnitCost?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  effectiveFrom?: string | null;

  @IsOptional()
  @IsString()
  effectiveTo?: string | null;
}

export class BomLineDto {
  @IsUUID()
  componentId!: string;

  @IsString()
  quantity!: string;

  @IsOptional()
  @IsString()
  wasteFactor?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortIndex?: number;

  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReplaceBomDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BomLineDto)
  lines!: BomLineDto[];
}

export class AddCatalogPrimitiveDto {
  @IsOptional()
  @IsUUID()
  quoteGroupId?: string;

  @IsOptional()
  @IsUUID()
  quoteComboId?: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderGroupId?: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderComboId?: string;

  @IsOptional()
  @IsUUID()
  workOrderGroupId?: string;

  @IsOptional()
  @IsUUID()
  workOrderComboId?: string;

  @IsUUID()
  catalogItemId!: string;

  @IsString()
  quantity!: string;
}

export class AddCatalogAssemblyDto {
  @IsUUID()
  catalogAssemblyId!: string;

  @IsString()
  quantity!: string;
}
