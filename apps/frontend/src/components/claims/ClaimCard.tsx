'use client';

import { FileText } from 'lucide-react';
import { EntityCard } from '@/components/ui/entity-card';
import type { Claim } from '@/types/api';

function formatAddress(claim: Claim): string {
  const addr = claim.address as { streetNumber?: string; streetName?: string; suburb?: string } | undefined;
  if (addr) {
    const parts = [addr.streetNumber, addr.streetName, addr.suburb].filter(Boolean);
    return parts.join(' ') || '';
  }
  return claim.addressSuburb ?? '';
}

export function ClaimCard({ claim }: { claim: Claim }) {
  const title = claim.claimNumber ?? claim.externalReference ?? claim.id;
  const subtitle = formatAddress(claim);
  const statusName = (claim.status as { name?: string })?.name ?? 'Unknown';
  const accountName = (claim.account as { name?: string })?.name;
  const lodgementDate = claim.lodgementDate
    ? new Date(claim.lodgementDate).toLocaleDateString()
    : '';

  return (
    <EntityCard
      href={`/claims/${claim.id}`}
      icon={FileText}
      accentColor="border-l-blue-500"
      title={title}
      subtitle={subtitle}
      badge={statusName}
      footer={
        <>
          {lodgementDate}
          {accountName && ` • ${accountName}`}
        </>
      }
    />
  );
}
