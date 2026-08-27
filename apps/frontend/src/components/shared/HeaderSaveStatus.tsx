'use client';

import { SetHeaderStatus } from '@/components/layout/SetHeaderStatus';
import {
  detailSaveStatus,
  type DetailSaveTone,
} from '@/components/shared/detail-autosave';
import { DetailSaveStatus } from '@/components/shared/DetailAutosaveActions';

export function HeaderSaveStatus({
  saving,
  publishing,
  saveError,
  justSaved,
  justPublished,
  dirty,
}: {
  saving?: boolean;
  publishing?: boolean;
  saveError?: string | null;
  justSaved?: boolean;
  justPublished?: boolean;
  dirty?: boolean;
}) {
  const { label, tone }: { label: string | null; tone: DetailSaveTone } =
    detailSaveStatus({
      saving,
      publishing,
      saveError,
      justSaved,
      justPublished,
      dirty,
    });

  return (
    <SetHeaderStatus>
      <DetailSaveStatus
        statusLabel={label}
        tone={tone}
        className={
          tone === 'error'
            ? 'text-xs whitespace-nowrap'
            : 'text-xs whitespace-nowrap text-yellow-400'
        }
      />
    </SetHeaderStatus>
  );
}
