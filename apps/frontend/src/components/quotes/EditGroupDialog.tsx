'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchGroupLabelLookupsAction } from '@/app/(app)/quotes/actions';
import type { ApiGroup } from '@/components/quotes/quote-line-items.types';

interface LookupOption {
  id: string;
  name?: string;
  externalReference?: string;
}

export interface EditGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ApiGroup;
  onSave: (params: { groupLabelLookupId?: string; description?: string }) => void;
  pending?: boolean;
}

export function EditGroupDialog({
  open,
  onOpenChange,
  group,
  onSave,
  pending,
}: EditGroupDialogProps) {
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [selectedLookupId, setSelectedLookupId] = useState('');
  const [description, setDescription] = useState('');
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setSelectedLookupId(group.groupLabel?.id ?? '');
    setDescription(group.description ?? '');
    startTransition(async () => {
      const result = await fetchGroupLabelLookupsAction();
      if (result.success && result.options) {
        setOptions(result.options);
      }
    });
  }, [open, group]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      groupLabelLookupId: selectedLookupId || undefined,
      description: description.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-group-label-select">Group label</Label>
            <select
              id="edit-group-label-select"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={selectedLookupId}
              onChange={(e) => setSelectedLookupId(e.target.value)}
              disabled={loading}
            >
              <option value="">Select a label…</option>
              {options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name ?? opt.externalReference ?? opt.id}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-group-description">Description</Label>
            <Input
              id="edit-group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Bedroom 1, Kitchen…"
            />
          </div>
          <DialogFooter>
            <Button type="submit" size="sm" disabled={pending || loading}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
