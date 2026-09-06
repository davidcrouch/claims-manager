'use client';

import {
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

export interface HeaderVisibilityEntry {
  override?: boolean;
  showQuantities?: boolean;
  showPricing?: boolean;
}

export interface ResolvedHeaderVisibility {
  showQuantities: boolean;
  showPricing: boolean;
}

export function resolveHeaderVisibility(
  key: string,
  parentQty: boolean,
  parentPrice: boolean,
  headerVisibility: Record<string, HeaderVisibilityEntry>,
  showColumnToggles: boolean,
): ResolvedHeaderVisibility {
  if (!showColumnToggles) return { showQuantities: true, showPricing: true };
  const entry = headerVisibility[key];
  if (!entry?.override) return { showQuantities: parentQty, showPricing: parentPrice };
  return {
    showQuantities: entry.showQuantities ?? parentQty,
    showPricing: entry.showPricing ?? parentPrice,
  };
}

export function HeaderVisibilityMenuItems({
  showQuantities,
  showPricing,
  onToggleQuantities,
  onTogglePricing,
}: {
  showQuantities: boolean;
  showPricing: boolean;
  onToggleQuantities: () => void;
  onTogglePricing: () => void;
}) {
  return (
    <>
      <DropdownMenuCheckboxItem
        checked={showQuantities}
        onCheckedChange={() => onToggleQuantities()}
      >
        Show Quantity
      </DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem
        checked={showPricing}
        onCheckedChange={() => onTogglePricing()}
      >
        Show Price
      </DropdownMenuCheckboxItem>
    </>
  );
}
