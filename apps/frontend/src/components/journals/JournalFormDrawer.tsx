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

export interface JournalFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType?: string;
  entityId?: string;
  createJournal: (data: { name: string; description?: string }) => Promise<Journal | null>;
  linkJournal?: (journalId: string) => Promise<boolean>;
  onCreated?: (journal: Journal) => void;
}

export function JournalFormDrawer({
  open,
  onOpenChange,
  entityType,
  entityId,
  createJournal,
  linkJournal,
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
      const journal = await createJournal({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      if (journal && entityType && entityId && linkJournal) {
        await linkJournal(journal.id);
      }

      setName('');
      setDescription('');
      if (journal) onCreated?.(journal);
    } catch (err) {
      console.error('JournalFormDrawer.handleSubmit:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 [&>button]:text-sidebar-foreground [&>button]:hover:bg-sidebar-accent [&>button]:hover:text-sidebar-foreground">
        <SheetHeader data-slot="drawer-header" className="border-b border-sidebar-border p-4 pr-12">
          <SheetTitle className="text-sidebar-foreground">New Journal</SheetTitle>
          <SheetDescription className="text-sidebar-foreground/65">
            Create a new journal{entityType ? ` and link it to this ${entityType.toLowerCase()}` : ''}.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-8 py-6">
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

          <SheetFooter className="mt-2 px-0">
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
