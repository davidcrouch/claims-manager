import { useMemo } from 'react';
import { useLineItems } from '../LineItemsProvider';

export interface LineItemColumnLayout {
  showDragHandle: boolean;
  showBulkSelect: boolean;
  showSelect: boolean;
  showCategory: boolean;
  showQuantities: boolean;
  showPricing: boolean;
  showPriceBreakdown: boolean;
  showMarkup: boolean;
  showGst: boolean;
  showInvoiceProgress: boolean;
  showActions: boolean;
  /** Number of trailing empty cells before total column */
  pricingSpacerCount: number;
}

export function useLineItemColumns(parentShowQuantities?: boolean, parentShowPricing?: boolean): LineItemColumnLayout {
  const { config, isReadOnly, selection, actions } = useLineItems();

  return useMemo(() => {
    const showQuantities = parentShowQuantities ?? config.showQuantities;
    const showPricing = parentShowPricing ?? config.showPricing;
    const showPriceBreakdown = showPricing && config.pricingDetail !== 'total-only';
    const showMarkup = showPriceBreakdown && config.showMarkup;
    const showGst = showPriceBreakdown && config.showGst;
    const showInvoiceProgress = config.showInvoiceProgress;
    const showSelect = !!selection;
    const showBulkSelect = !isReadOnly && !showSelect;
    const showDragHandle = !isReadOnly && !!actions.onReorderLineItems;
    const showActions = !isReadOnly && !!(actions.onDeleteItem || actions.onDeleteCombo || actions.onDeleteScope);

    let pricingSpacerCount = 0;
    if (showPriceBreakdown) {
      pricingSpacerCount += 2; // unit cost + extended
      if (showMarkup) pricingSpacerCount += 1;
      if (showGst) pricingSpacerCount += 1;
    }

    return {
      showDragHandle,
      showBulkSelect,
      showSelect,
      showCategory: config.showCategory,
      showQuantities,
      showPricing,
      showPriceBreakdown,
      showMarkup,
      showGst,
      showInvoiceProgress,
      showActions,
      pricingSpacerCount,
    };
  }, [config, isReadOnly, selection, actions, parentShowQuantities, parentShowPricing]);
}
