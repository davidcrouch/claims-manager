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
  showUnitPrice: boolean;
  showExtended: boolean;
  showBuyCost: boolean;
  showMarkup: boolean;
  showGst: boolean;
  isCostPricing: boolean;
  showInvoiceProgress: boolean;
  showPreviouslyInvoiced: boolean;
  showItemTypeColumn: boolean;
  showActions: boolean;
  /** Number of trailing empty cells before total column */
  pricingSpacerCount: number;
}

export function useLineItemColumns(parentShowQuantities?: boolean, parentShowPricing?: boolean): LineItemColumnLayout {
  const { config, isReadOnly, selection, actions } = useLineItems();

  return useMemo(() => {
    const showQuantities = parentShowQuantities ?? config.showQuantities;
    const showPricing = parentShowPricing ?? config.showPricing;
    const isCostPricing = config.pricingDetail === 'cost';
    const showFullBreakdown = showPricing && config.pricingDetail === 'full';
    const showCostBreakdown = showPricing && isCostPricing;
    const showPriceBreakdown = showFullBreakdown || showCostBreakdown;
    const showUnitPrice = showFullBreakdown;
    const showExtended = showFullBreakdown || showCostBreakdown;
    const showBuyCost = (showFullBreakdown && config.showBuyCost) || showCostBreakdown;
    const showMarkup = showFullBreakdown && config.showMarkup;
    const showGst = showFullBreakdown && config.showGst;
    const showInvoiceProgress = config.showInvoiceProgress;
    const showPreviouslyInvoiced = config.showPreviouslyInvoiced;
    const showItemTypeColumn = config.showItemTypeColumn;
    const showSelect = !!selection;
    const showBulkSelect = !isReadOnly && !showSelect;
    const showDragHandle = !isReadOnly && !!actions.onReorderLineItems;
    const showActions = !isReadOnly && !!(actions.onDeleteItem || actions.onDeleteCombo || actions.onDeleteScope);

    let pricingSpacerCount = 0;
    if (showPriceBreakdown) {
      if (showBuyCost) pricingSpacerCount += 1;
      if (showUnitPrice) pricingSpacerCount += 1;
      if (showExtended) pricingSpacerCount += 1;
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
      showUnitPrice,
      showExtended,
      showBuyCost,
      showMarkup,
      showGst,
      isCostPricing,
      showInvoiceProgress,
      showPreviouslyInvoiced,
      showItemTypeColumn,
      showActions,
      pricingSpacerCount,
    };
  }, [config, isReadOnly, selection, actions, parentShowQuantities, parentShowPricing]);
}
