'use client';

import { useEffect, useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchGroupLabelLookupsAction } from '@/app/(app)/quotes/actions';

interface LookupOption {
  id: string;
  name?: string;
  externalReference?: string;
}

export interface AddGroupPopoverProps {
  onCreateGroup: (params: { groupLabelLookupId?: string; description?: string }) => void;
  disabled?: boolean;
}

export function AddGroupPopover({ onCreateGroup, disabled }: AddGroupPopoverProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [selectedLookupId, setSelectedLookupId] = useState('');
  const [description, setDescription] = useState('');
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const result = await fetchGroupLabelLookupsAction();
      if (result.success && result.options) {
        setOptions(result.options);
      }
    });
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onCreateGroup({
      groupLabelLookupId: selectedLookupId || undefined,
      description: description.trim() || undefined,
    });
    setSelectedLookupId('');
    setDescription('');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" disabled={disabled} />
        }
      >
        <Plus className="mr-1 h-4 w-4" />
        Add group
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-label-select">Group label</Label>
            <select
              id="group-label-select"
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
            {options.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground">
                No group labels configured. You can still create a group with a description.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-description">Description (optional)</Label>
            <Input
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Bedroom 1, Kitchen…"
            />
          </div>
          <DialogFooter>
            <Button type="submit" size="sm" disabled={loading}>
              Create group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
