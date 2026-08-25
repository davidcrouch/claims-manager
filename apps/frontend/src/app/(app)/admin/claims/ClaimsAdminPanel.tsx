'use client';

import { useState, useTransition } from 'react';
import { Building2, Check, X, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { AdminPageHeader } from '@/components/layout/PageHeaderLayout';
import { Input } from '@/components/ui/input';
import { approveClaimAction, rejectClaimAction } from './actions';
import type { GhostOrganisation, OrganisationClaim } from '@/types/api';

interface ClaimsAdminPanelProps {
  initialClaims: OrganisationClaim[];
  initialGhosts: GhostOrganisation[];
}

function statusColor(status: string) {
  switch (status) {
    case 'approved':
      return 'bg-green-50 text-green-700 ring-green-600/20';
    case 'rejected':
      return 'bg-red-50 text-red-700 ring-red-600/20';
    case 'under_review':
      return 'bg-blue-50 text-blue-700 ring-blue-600/20';
    default:
      return 'bg-amber-50 text-amber-700 ring-amber-600/20';
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'approved':
      return <Check className="h-3.5 w-3.5" />;
    case 'rejected':
      return <X className="h-3.5 w-3.5" />;
    case 'under_review':
      return <ShieldCheck className="h-3.5 w-3.5" />;
    default:
      return <Clock className="h-3.5 w-3.5" />;
  }
}

export function ClaimsAdminPanel({ initialClaims, initialGhosts }: ClaimsAdminPanelProps) {
  const [claims, setClaims] = useState(initialClaims);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const ghostMap = new Map(initialGhosts.map((g) => [g.id, g]));

  const handleApprove = (claimId: string) => {
    setActionError(null);
    startTransition(async () => {
      try {
        await approveClaimAction(claimId);
        setClaims((prev) =>
          prev.map((c) => (c.id === claimId ? { ...c, status: 'approved' } : c)),
        );
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Failed to approve claim');
      }
    });
  };

  const handleReject = (claimId: string) => {
    setActionError(null);
    startTransition(async () => {
      try {
        await rejectClaimAction(claimId, rejectNotes[claimId]);
        setClaims((prev) =>
          prev.map((c) => (c.id === claimId ? { ...c, status: 'rejected' } : c)),
        );
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Failed to reject claim');
      }
    });
  };

  const pendingClaims = claims.filter((c) => c.status === 'pending' || c.status === 'under_review');
  const resolvedClaims = claims.filter((c) => c.status === 'approved' || c.status === 'rejected');

  return (
    <>
      <SetPageHeader>
        <AdminPageHeader
          icon={Building2}
          title="Organisation Claims"
          description="Review and approve ownership claims from organisations wanting to take custody of their ghost profiles and associated purchase orders."
        />
      </SetPageHeader>

      <div className="space-y-8">

      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}

      {pendingClaims.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-700">
            Pending Review ({pendingClaims.length})
          </h3>
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {pendingClaims.map((claim) => {
              const ghost = ghostMap.get(claim.ghostOrganisationId);
              return (
                <div key={claim.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                        <Building2 className="h-4 w-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {ghost?.tradingName ?? ghost?.legalName ?? ghost?.name ?? 'Unknown Organisation'}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                          {ghost?.abn && <span>ABN: {ghost.abn}</span>}
                          {ghost?.primaryEmail && <span>{ghost.primaryEmail}</span>}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          Claimed {new Date(claim.createdAt).toLocaleDateString()}
                        </p>
                        {claim.verificationMethod && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                            <ShieldCheck className="h-3 w-3" />
                            {claim.verificationMethod.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(claim.id)}
                        disabled={isPending}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(claim.id)}
                        disabled={isPending}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Approve
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 ml-12">
                    <Input
                      placeholder="Rejection notes (optional)"
                      value={rejectNotes[claim.id] ?? ''}
                      onChange={(e) =>
                        setRejectNotes((prev) => ({ ...prev, [claim.id]: e.target.value }))
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pendingClaims.length === 0 && (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
          <p className="text-sm text-slate-400">No pending claims to review</p>
        </div>
      )}

      {resolvedClaims.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-700">
            Resolved ({resolvedClaims.length})
          </h3>
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {resolvedClaims.map((claim) => {
              const ghost = ghostMap.get(claim.ghostOrganisationId);
              return (
                <div key={claim.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                      <Building2 className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {ghost?.tradingName ?? ghost?.legalName ?? ghost?.name ?? 'Unknown'}
                      </p>
                      {claim.reviewedAt && (
                        <p className="text-xs text-slate-400">
                          Reviewed {new Date(claim.reviewedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusColor(claim.status)}`}
                  >
                    {statusIcon(claim.status)}
                    {claim.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </>
  );
}
