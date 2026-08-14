'use client';

import { ToggleLeft } from 'lucide-react';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { FeaturesSettingsPanel } from './FeaturesSettingsPanel';
import type { FeatureDef } from '@/app/(app)/admin/settings/features-actions';

interface Props {
  features: FeatureDef[];
  featuresError?: string | null;
  canManage: boolean;
}

export function FeaturesPageClient({ features, featuresError, canManage }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={ToggleLeft}
          title="Features"
          total={features.length}
          accent="slate"
        />
      </SetPageHeader>

      <div className="flex-1 px-6 pb-6 pt-4" style={{ minHeight: 0, overflow: 'auto' }}>
        <FeaturesSettingsPanel
          initialFeatures={features}
          initialError={featuresError}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
