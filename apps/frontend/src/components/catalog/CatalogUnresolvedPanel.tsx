'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface CatalogUnresolvedEntry {
  id: string;
  externalReference: string;
  sourceEntity: string | null;
  sourceEntityId: string | null;
  createdAt: string;
}

export interface CatalogUnresolvedPanelProps {
  entries: CatalogUnresolvedEntry[];
}

export function CatalogUnresolvedPanel({ entries }: CatalogUnresolvedPanelProps) {
  if (entries.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          Unresolved external catalogue IDs ({entries.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-amber-800">
          These Crunchwork catalogue references were seen on inbound sync but do not match a local
          item. Set the matching{' '}
          <span className="font-medium">external reference</span> on a catalogue item to link them.
        </p>
        <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-amber-100 bg-white/80 px-2 py-1.5"
            >
              <span className="font-mono font-medium">{entry.externalReference}</span>
              <span className="text-muted-foreground">
                {entry.sourceEntity ?? 'unknown'}
                {entry.sourceEntityId ? ` · ${entry.sourceEntityId.slice(0, 8)}…` : ''}
              </span>
            </li>
          ))}
        </ul>
        <Link href="/admin/catalog/new" className="text-xs text-primary hover:underline">
          Create or edit catalogue item →
        </Link>
      </CardContent>
    </Card>
  );
}
