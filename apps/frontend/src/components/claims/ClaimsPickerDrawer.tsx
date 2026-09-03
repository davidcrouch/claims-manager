'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
} from '@/components/forms/BottomFormDrawer';
import { CLAIMS_PICKER_DRAWER_WIDTH_CLASS } from '@/components/forms/form-drawer-layout';
import { ClaimsListClient } from '@/components/claims/ClaimsListClient';
import { fetchClaimsPickerBootstrapAction } from '@/app/(app)/claims/actions';
import type { Claim, PaginatedResponse } from '@/types/api';

const EXIT_ANIMATION_MS = 350;

export interface ClaimsPickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClaimId?: string;
  onClaimSelect: (claim: Claim) => void;
  title?: string;
  description?: string;
}

type Bootstrap = {
  claims: PaginatedResponse<Claim>;
  statusOptions: { id: string; name: string }[];
  accountOptions: { id: string; name: string }[];
  jobTypes: { id: string; name: string }[];
  currentUserId: string | null;
  initialFetchKey?: string;
};

export function ClaimsPickerDrawer({
  open,
  onOpenChange,
  selectedClaimId,
  onClaimSelect,
  title = 'Select claim',
  description = 'Select a claim to link to this job.',
}: ClaimsPickerDrawerProps) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(false);
  const [listSession, setListSession] = useState(0);

  useEffect(() => {
    if (!open) return;
    setListSession((session) => session + 1);
    let cancelled = false;
    setLoading(true);
    fetchClaimsPickerBootstrapAction()
      .then((res) => {
        if (cancelled || !res) return;
        setBootstrap(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSelect = useCallback(
    (claim: Claim) => {
      onOpenChange(false);
      setTimeout(() => onClaimSelect(claim), EXIT_ANIMATION_MS);
    },
    [onOpenChange, onClaimSelect],
  );

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      icon={<FileText className="h-5 w-5" />}
      widthClassName={CLAIMS_PICKER_DRAWER_WIDTH_CLASS}
    >
      <BottomFormDrawerBody className="flex h-full flex-col !px-0 !py-0">
        {loading && !bootstrap ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : bootstrap ? (
          <ClaimsListClient
            key={`claims-picker-${selectedClaimId ?? 'none'}-${listSession}`}
            variant="picker"
            initialData={bootstrap.claims}
            initialFetchKey={bootstrap.initialFetchKey ?? ''}
            statusOptions={bootstrap.statusOptions}
            accountOptions={bootstrap.accountOptions}
            jobTypes={bootstrap.jobTypes}
            currentUserId={bootstrap.currentUserId}
            selectedClaimId={selectedClaimId}
            onClaimSelect={handleSelect}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center py-16">
            <p className="text-sm text-slate-400">Unable to load claims.</p>
          </div>
        )}
      </BottomFormDrawerBody>
    </BottomFormDrawer>
  );
}
