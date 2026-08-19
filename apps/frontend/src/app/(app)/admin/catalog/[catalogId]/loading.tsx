'use client';

import { CreateSubmitOverlay } from '@/components/forms/CreateSubmitOverlay';

export default function CatalogDetailLoading() {
  return <CreateSubmitOverlay phase="loading" entityLabel="catalogue" />;
}
