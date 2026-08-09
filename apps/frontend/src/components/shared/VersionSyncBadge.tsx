'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface VersionSyncBadgeProps {
  sourceVersionNumber: number;
  latestAvailableVersion: number;
  versionAcknowledged: boolean;
  entityType: 'proposal' | 'work_order' | 'bill' | 'job';
  entityId: string;
  onPullVersion: () => void;
  pulling?: boolean;
}

export function VersionSyncBadge({
  sourceVersionNumber,
  latestAvailableVersion,
  versionAcknowledged,
  onPullVersion,
  pulling = false,
}: VersionSyncBadgeProps) {
  if (
    sourceVersionNumber === latestAvailableVersion &&
    versionAcknowledged
  ) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        Version {sourceVersionNumber} — Current
      </Badge>
    );
  }

  if (latestAvailableVersion > sourceVersionNumber) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          Version {latestAvailableVersion} available
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={onPullVersion}
          disabled={pulling}
          className="h-6 px-2 text-xs"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${pulling ? 'animate-spin' : ''}`} />
          Pull Latest
        </Button>
      </div>
    );
  }

  if (!versionAcknowledged) {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        Updated to version {sourceVersionNumber} — Review changes
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-muted-foreground">
      Version {sourceVersionNumber}
    </Badge>
  );
}
