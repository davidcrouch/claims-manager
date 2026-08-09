'use client';

import { Badge } from '@/components/ui/badge';

interface SupplyChainDepthBadgeProps {
  depth: number;
  maxDepth?: number;
}

export function SupplyChainDepthBadge({
  depth,
  maxDepth = 5,
}: SupplyChainDepthBadgeProps) {
  const remaining = maxDepth - depth;

  if (depth === 0) {
    return (
      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
        Direct
      </Badge>
    );
  }

  if (remaining <= 0) {
    return (
      <Badge variant="destructive">
        Maximum sub-contracting depth reached
      </Badge>
    );
  }

  if (remaining <= 1) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
        Tier {depth} Sub — {remaining} level{remaining === 1 ? '' : 's'} remaining
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-muted-foreground">
      Tier {depth} Sub
    </Badge>
  );
}
