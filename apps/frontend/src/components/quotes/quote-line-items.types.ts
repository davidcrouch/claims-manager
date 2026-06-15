export interface ApiLookup {
  id?: string;
  name?: string;
  externalReference?: string;
}

export interface ApiItem {
  id?: string;
  name?: string;
  description?: string;
  type?: string;
  category?: string;
  subCategory?: string | null;
  index?: number;
  quantity?: number;
  tax?: number;
  unitCost?: number;
  buyCost?: number;
  markupType?: string;
  markupValue?: number;
  unitType?: ApiLookup;
  pcps?: string | null;
  note?: string | null;
  catalogItemId?: string;
  internal?: boolean;
  mismatches?: Array<{ property?: string; catalogValue?: string }>;
  tags?: string[];
  lineScopeStatus?: ApiLookup;
  subTotal?: number;
  totalTax?: number;
  total?: number;
  allocatedCost?: number;
  committedCost?: number;
}

export interface ApiCombo {
  id?: string;
  name?: string;
  description?: string;
  category?: string;
  subCategory?: string | null;
  index?: number;
  quantity?: number;
  catalogComboId?: string;
  lineScopeStatus?: ApiLookup;
  items?: ApiItem[];
  subTotal?: number;
  totalTax?: number;
  total?: number;
  allocatedCost?: number;
  committedCost?: number;
}

export interface ApiGroup {
  id?: string;
  groupLabel?: ApiLookup;
  description?: string;
  length?: number;
  width?: number;
  height?: number;
  index?: number;
  subTotal?: number;
  totalTax?: number;
  total?: number;
  items?: ApiItem[];
  combos?: ApiCombo[];
}

export interface FlatLineItemRow {
  rowKey: string;
  groupId?: string;
  groupLabel: string;
  assemblyName: string | null;
  item: ApiItem;
}
