'use client';

import { Calendar, Clock, StickyNote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  SectionCard,
  DefRow,
  formatDateTime,
} from '@/components/shared/detail';
import type { Job } from '@/types/api';

type Dict = Record<string, unknown>;

function getCustom(job: Job): Dict {
  return (job.customData as Dict | undefined) ?? {};
}

export function JobTimelineTab({ job }: { job: Job }) {
  const custom = getCustom(job);
  const cwUpdatedAt =
    (custom.cwUpdatedAtDate as string | undefined) ??
    ((job.apiPayload as Dict | undefined)?.updatedAtDate as string | undefined);

  return (
    <div className="space-y-4">
      <SectionCard
        title="Audit Trail"
        icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow label="Created" value={formatDateTime(job.createdAt)} />
        <DefRow label="Updated" value={formatDateTime(job.updatedAt)} />
        {cwUpdatedAt && (
          <DefRow
            label="Crunchwork updated"
            value={formatDateTime(cwUpdatedAt)}
          />
        )}
      </SectionCard>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <StickyNote className="h-4 w-4 text-muted-foreground" />
            Notes &amp; Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <Clock className="mr-1 inline h-3 w-3" />
            Notes and audit events will appear here once the timeline API is
            connected.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
