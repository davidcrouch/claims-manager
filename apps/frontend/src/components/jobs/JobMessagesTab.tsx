'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchJobMessagesAction, acknowledgeMessageAction } from '@/app/(app)/jobs/[id]/actions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageFormDrawer } from '@/components/forms/MessageFormDrawer';
import type { Message } from '@/types/api';
import { MessageSquarePlus, Check } from 'lucide-react';

export function JobMessagesTab({ jobId, claimId }: { jobId: string; claimId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJobMessagesAction(jobId);
      setMessages(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  async function handleAcknowledge(id: string) {
    const result = await acknowledgeMessageAction(id);
    if (result.success) {
      loadMessages();
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

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
          if (!open) loadMessages();
        }}
        jobId={jobId}
        claimId={claimId}
      />
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">No messages.</p>
      ) : (
        <div className="space-y-2">
          {messages.map((m) => (
            <Card key={m.id}>
              <CardContent className="py-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-medium text-sm">{m.subject ?? '(No subject)'}</p>
                    <p className="text-sm text-muted-foreground mt-1">{m.body ?? ''}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}
                      {m.acknowledgedAt && (
                        <span className="ml-2">Acknowledged {new Date(m.acknowledgedAt).toLocaleString()}</span>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
