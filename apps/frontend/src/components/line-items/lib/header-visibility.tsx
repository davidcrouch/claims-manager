'use client';

import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

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

export function HeaderVisibilityToggles({
  isOverridden,
  onToggleOverride,
  showQuantities,
  showPricing,
  onToggleQuantities,
  onTogglePricing,
  colorScheme = 'slate',
}: {
  isOverridden: boolean;
  onToggleOverride: () => void;
  showQuantities: boolean;
  showPricing: boolean;
  onToggleQuantities: () => void;
  onTogglePricing: () => void;
  colorScheme?: 'slate' | 'blue' | 'violet';
}) {
  const labelCls = {
    slate: 'text-slate-600',
    blue: 'text-blue-700',
    violet: 'text-violet-700',
  }[colorScheme];

  return (
    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
      <label className={cn('flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide', labelCls)}>
        <Switch checked={isOverridden} onCheckedChange={onToggleOverride} />
        Override
      </label>
      {isOverridden && (
        <>
          <label className={cn('flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide', labelCls)}>
            <Switch checked={showQuantities} onCheckedChange={onToggleQuantities} />
            Qty
          </label>
          <label className={cn('flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide', labelCls)}>
            <Switch checked={showPricing} onCheckedChange={onTogglePricing} />
            Price
          </label>
        </>
      )}
    </div>
  );
}
