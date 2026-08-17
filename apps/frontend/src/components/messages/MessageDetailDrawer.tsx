'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { formatDateTime } from '@/components/shared/detail';
import { resolveJobName } from '@/components/shared/job-label';
import type { Message } from '@/types/api';

export interface MessageDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: Message | null;
  jobNameById?: Record<string, string>;
}

function payloadName(
  payload: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = payload?.[key] as Record<string, unknown> | undefined;
  const name = value?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function messageSender(message: Message): string {
  const payload = message.messagePayload ?? {};
  return (
    payloadName(payload, 'createdByUser') ||
    payloadName(payload, 'createdBy') ||
    message.createdByUserId ||
    'System'
  );
}

function messageRecipient(message: Message): string {
  return payloadName(message.messagePayload, 'toUser') || '—';
}

function messageJobId(message: Message): string | null {
  return message.toJobId ?? message.fromJobId ?? null;
}

function messageTypeName(message: Message): string | null {
  const type = message.messagePayload?.messageType as
    | Record<string, unknown>
    | undefined;
  const name = type?.name ?? type?.externalReference;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function displayBody(message: Message): string {
  const payload = message.messagePayload ?? {};
  if (message.body?.trim()) return message.body;
  if (typeof payload.text === 'string' && payload.text.trim()) return payload.text;
  if (typeof payload.body === 'string' && payload.body.trim()) return payload.body;
  return '';
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

export function MessageDetailDrawer({
  open,
  onOpenChange,
  message,
  jobNameById,
}: MessageDetailDrawerProps) {
  if (!message) {
    return (
      <BottomFormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Message"
        description="Message details"
        icon={<Mail className="h-5 w-5" />}
        widthClassName="w-[60%]"
      >
        <BottomFormDrawerBody>
          <p className="text-sm text-slate-500">No message selected.</p>
        </BottomFormDrawerBody>
        <BottomFormDrawerFooter>
          <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </BottomFormDrawerFooter>
      </BottomFormDrawer>
    );
  }

  const subject = message.subject?.trim() || '(No subject)';
  const sender = messageSender(message);
  const recipient = messageRecipient(message);
  const jobId = messageJobId(message);
  const jobLabel = resolveJobName(jobId, jobNameById);
  const typeName = messageTypeName(message);
  const body = displayBody(message);
  const needsAck = !!message.acknowledgementRequired && !message.acknowledgedAt;
  const isAcked = !!message.acknowledgedAt;
  const description = [
    typeName,
    formatDateTime(message.createdAt),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={subject}
      description={description || 'Message details'}
      icon={<Mail className="h-5 w-5" />}
      widthClassName="w-[60%]"
    >
      <BottomFormDrawerBody className="px-0! py-0!">
        <div className="flex h-full min-h-0 flex-col">
          {/* Email header */}
          <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-10 py-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {message.originType === 'provider' && (
                <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                  Provider
                </span>
              )}
              {typeName && (
                <span className="inline-flex items-center rounded bg-slate-200/80 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  {typeName}
                </span>
              )}
              {needsAck && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200/70">
                  <Clock className="h-3 w-3" />
                  Acknowledgement required
                </span>
              )}
              {isAcked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/70">
                  <CheckCircle2 className="h-3 w-3" />
                  Acknowledged {formatDateTime(message.acknowledgedAt)}
                </span>
              )}
            </div>

            <h3 className="font-heading text-xl font-semibold leading-snug text-slate-900">
              {subject}
            </h3>

            <dl className="mt-5 space-y-2.5">
              <MetaRow label="From">
                <span className="font-medium">{sender}</span>
              </MetaRow>
              <MetaRow label="To">
                <span>{recipient}</span>
              </MetaRow>
              <MetaRow label="Date">
                <span>{formatDateTime(message.createdAt)}</span>
              </MetaRow>
              {(jobId || jobLabel) && (
                <MetaRow label="Job">
                  {jobId ? (
                    <Link
                      href={`/jobs/${jobId}`}
                      className="inline-flex items-center gap-1.5 font-medium text-emerald-700 hover:underline"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {jobLabel || jobId}
                    </Link>
                  ) : (
                    jobLabel || '—'
                  )}
                </MetaRow>
              )}
            </dl>
          </div>

          {/* Email body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-10 py-8">
            {body ? (
              <div
                className="prose prose-slate max-w-none prose-p:leading-relaxed prose-a:text-emerald-700"
                dangerouslySetInnerHTML={{ __html: body }}
              />
            ) : (
              <p className="text-sm italic text-slate-500">No message content.</p>
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
