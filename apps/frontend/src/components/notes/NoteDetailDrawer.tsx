'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { formatDateTime } from '@/components/shared/detail';
import { resolveJobName } from '@/components/shared/job-label';
import type { JobNote } from '@/types/api';

export interface NoteDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: JobNote | null;
  jobNameById?: Record<string, string>;
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 text-sm">
      <dt className="pt-0.5 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-slate-900">{children}</dd>
    </div>
  );
}

export function NoteDetailDrawer({
  open,
  onOpenChange,
  note,
  jobNameById,
}: NoteDetailDrawerProps) {
  if (!note) {
    return (
      <BottomFormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Note"
        description="Note details"
        icon={<StickyNote className="h-5 w-5" />}
      >
        <BottomFormDrawerBody>
          <p className="text-sm text-slate-500">No note selected.</p>
        </BottomFormDrawerBody>
        <BottomFormDrawerFooter>
          <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </BottomFormDrawerFooter>
      </BottomFormDrawer>
    );
  }

  const jobLabel = resolveJobName(note.jobId, jobNameById);
  const author = note.createdByName?.trim() || note.createdByUserId || 'Unknown';

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Note"
      description={formatDateTime(note.createdAt) || 'Note details'}
      icon={<StickyNote className="h-5 w-5" />}
    >
      <BottomFormDrawerBody className="px-0! py-0!">
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-10 py-6">
            <dl className="space-y-2.5">
              <MetaRow label="Author">
                <span className="font-medium">{author}</span>
              </MetaRow>
              <MetaRow label="Date">
                <span>{formatDateTime(note.createdAt)}</span>
              </MetaRow>
              <MetaRow label="Job">
                {note.jobId ? (
                  <Link
                    href={`/jobs/${note.jobId}`}
                    className="inline-flex items-center gap-1.5 font-medium text-emerald-700 hover:underline"
                  >
                    <StickyNote className="h-3.5 w-3.5" />
                    {jobLabel || note.jobId}
                  </Link>
                ) : (
                  jobLabel || '—'
                )}
              </MetaRow>
            </dl>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-10 py-8">
            {note.body ? (
              <div
                className="prose prose-slate max-w-none prose-p:leading-relaxed prose-a:text-emerald-700"
                dangerouslySetInnerHTML={{ __html: note.body }}
              />
            ) : (
              <p className="text-sm italic text-slate-500">No note content.</p>
            )}
          </div>
        </div>
      </BottomFormDrawerBody>
      <BottomFormDrawerFooter>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => onOpenChange(false)}
        >
          Close
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
