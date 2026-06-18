'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Package, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getQuoteCatalogMismatchesAction,
  scanQuoteCatalogMismatchesAction,
} from '@/app/(app)/quotes/actions';

export interface QuoteCatalogToolbarProps {
  quoteId: string;
  quantity: string;
  onQuantityChange: (value: string) => void;
  pending?: boolean;
  onOpenCatalogDrawer: () => void;
  message?: string | null;
  children?: React.ReactNode;
}

export function QuoteCatalogToolbar({
  quoteId,
  quantity,
  onQuantityChange,
  pending = false,
  onOpenCatalogDrawer,
  message = null,
  children,
}: QuoteCatalogToolbarProps) {
  const router = useRouter();
  const [mismatchCount, setMismatchCount] = useState(0);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getQuoteCatalogMismatchesAction(quoteId);
      if (result.success && result.mismatches) {
        setMismatchCount(result.mismatches.length);
      }
    });
  }, [quoteId]);

  function handleScanMismatches() {
    setScanMessage(null);
    startTransition(async () => {
      const result = await scanQuoteCatalogMismatchesAction(quoteId);
      if (!result.success) {
        setScanMessage(result.error ?? 'Scan failed');
        return;
      }
      setMismatchCount(result.mismatches?.length ?? 0);
      setScanMessage(
        result.updatedCount
          ? `Flagged ${result.updatedCount} line(s) with catalogue price drift`
          : 'No catalogue price mismatches found',
      );
      router.refresh();
    });
  }

  const statusMessage = message ?? scanMessage;
  const busy = pending || scanPending;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Catalogue</p>
          <p className="text-xs text-muted-foreground">
            Open the catalogue drawer and drag items onto a line item group below.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min="0.0001"
            step="any"
            className="h-8 w-20"
            value={quantity}
            onChange={(e) => onQuantityChange(e.target.value)}
            aria-label="Quantity"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onOpenCatalogDrawer}
          >
            <Package className="mr-1 h-4 w-4" />
            Add item
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={handleScanMismatches}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Scan price drift
          </Button>
          {children}
        </div>
      </div>

      {mismatchCount > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {mismatchCount} line(s) have catalogue price mismatches — run scan to flag them on line items.
        </div>
      )}

      {statusMessage && <p className="text-xs text-muted-foreground">{statusMessage}</p>}
    </div>
  );
}
