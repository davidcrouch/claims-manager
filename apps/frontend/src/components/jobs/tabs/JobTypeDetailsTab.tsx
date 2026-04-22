'use client';

import type { Job } from '@/types/api';
import { getJobTypeKind } from '../util/jobType';
import { TemporaryAccommodationPanel } from './JobTypePanels/TemporaryAccommodationPanel';
import { SpecialistPanel } from './JobTypePanels/SpecialistPanel';
import { RectificationPanel } from './JobTypePanels/RectificationPanel';
import { InternalAuditPanel } from './JobTypePanels/InternalAuditPanel';

export function JobTypeDetailsTab({ job }: { job: Job }) {
  const kind = getJobTypeKind(job);

  switch (kind) {
    case 'temporary-accommodation':
      return <TemporaryAccommodationPanel job={job} />;
    case 'specialist':
      return <SpecialistPanel job={job} />;
    case 'rectification':
      return <RectificationPanel job={job} />;
    case 'internal-audit':
      return <InternalAuditPanel job={job} />;
    default:
      return null;
  }
}
