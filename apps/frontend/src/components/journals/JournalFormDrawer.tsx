'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import type { Journal } from '@/types/api';
import type { ApiClient } from '@/lib/api-client';

export interface JournalFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType?: string;
  entityId?: string;
  api: ApiClient;
  onCreated?: (journal: Journal) => void;
}

export function JournalFormDrawer({
  open,
  onOpenChange,
  entityType,
  entityId,
  api,
  onCreated,
}: JournalFormDrawerProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const journal = await api.createJournal({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      if (entityType && entityId) {
        await api.linkJournalToEntity(journal.id, entityType, entityId);
      }

      setName('');
      setDescription('');
      onCreated?.(journal);
    } catch (err) {
      console.error('JournalFormDrawer.handleSubmit:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>New Journal</SheetTitle>
          <SheetDescription>
            Create a new journal{entityType ? ` and link it to this ${entityType.toLowerCase()}` : ''}.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="journal-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="journal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Site Visit Notes"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="journal-description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="journal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description (optional)"
              rows={3}
            />
          </div>

          <SheetFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || submitting}>
              {submitting ? 'Creating…' : 'Create Journal'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
