'use client';

import { useEffect, useState } from 'react';
import { Mail, MessageSquare, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchEntityMessagesAction } from '@/app/(app)/messages/actions';
import { formatDateTime, PhaseUnavailable } from '@/components/shared/detail';
import type { Message } from '@/types/api';

interface EntityMessagesTabProps {
  entityId: string;
  entityType: 'job' | 'claim';
  onSendMessage?: () => void;
}

function MessageRow({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false);

  const payload = message.messagePayload ?? {};
  const createdBy = (payload.createdByUser as Record<string, unknown> | undefined)?.name
    ?? (payload.createdBy as Record<string, unknown> | undefined)?.name
    ?? message.createdByUserId
    ?? 'System';
  const displayBody = message.body
    ?? (payload.text as string | undefined)
    ?? '';
  const isAcknowledged = !!message.acknowledgedAt;

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="mt-0.5 shrink-0">
          {isAcknowledged ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : message.acknowledgementRequired ? (
            <Clock className="h-4 w-4 text-amber-500" />
          ) : (
            <Mail className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {message.subject || '(No subject)'}
            </span>
            {message.originType === 'provider' && (
              <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                CW
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>From: {createdBy as string}</span>
            <span className="text-border">|</span>
            <span>{formatDateTime(message.createdAt)}</span>
          </div>
        </div>
        <div className="shrink-0 mt-1">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 pl-11">
          {displayBody ? (
            <div
              className="prose prose-sm max-w-none text-sm text-foreground"
              dangerouslySetInnerHTML={{ __html: displayBody }}
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">No message content.</p>
          )}
          {message.acknowledgementRequired && (
            <div className="mt-2 text-xs text-muted-foreground">
              {isAcknowledged
                ? `Acknowledged ${formatDateTime(message.acknowledgedAt)}`
                : 'Acknowledgement required'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EntityMessagesTab({
  entityId,
  entityType,
  onSendMessage,
}: EntityMessagesTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseUnavailable, setPhaseUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchEntityMessagesAction(entityType, entityId);
      if (cancelled) return;
      setMessages(res.data);
      setPhaseUnavailable(res.phaseUnavailable);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId, entityType]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (phaseUnavailable) {
    return <PhaseUnavailable phase="Phase 2" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Messages ({messages.length})
        </CardTitle>
        {onSendMessage && (
          <Button size="sm" onClick={onSendMessage} className="bg-blue-600 text-white hover:bg-blue-500">
            <Mail className="mr-1 h-3 w-3" />
            Send Message
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {messages.length === 0 ? (
          <div className="px-4 pb-4">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/10 py-8">
              <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No messages yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Messages sent to and from this {entityType} will appear here
              </p>
            </div>
          </div>
        ) : (
          <div>
            {messages.map((m) => (
              <MessageRow key={m.id} message={m} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
