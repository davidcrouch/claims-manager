'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageSquarePlus, Check, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageFormDrawer } from '@/components/forms/MessageFormDrawer';
import {
  fetchJobMessagesAction,
  acknowledgeMessageAction,
} from '@/app/(app)/jobs/[id]/actions';
import { formatDateTime } from '@/components/shared/detail';
import type { Message } from '@/types/api';

export function JobMessagesTab({
  jobId,
  claimId,
}: {
  jobId: string;
  claimId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJobMessagesAction(jobId);
      setMessages(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAcknowledge(id: string) {
    const result = await acknowledgeMessageAction(id);
    if (result.success) {
      load();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDrawerOpen(true)} size="sm">
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          Send Message
        </Button>
      </div>
      <MessageFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) load();
        }}
        jobId={jobId}
        claimId={claimId}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Messages ({messages.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <p className="px-4 text-sm text-muted-foreground">Loading...</p>
          ) : messages.length === 0 ? (
            <p className="px-4 text-sm text-muted-foreground">No messages.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {messages.map((m) => (
                <li key={m.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">
                        {m.subject ?? '(No subject)'}
                      </p>
                      {m.body && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                          {m.body}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDateTime(m.createdAt)}
                        {m.acknowledgedAt && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <Check className="h-3 w-3" />
                            Acknowledged {formatDateTime(m.acknowledgedAt)}
                          </span>
                        )}
                      </p>
                    </div>
                    {!m.acknowledgedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAcknowledge(m.id)}
                        title="Acknowledge"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
