'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { ContactFormDrawer } from '@/components/contacts/ContactFormDrawer';
import {
  JobContactsPicker,
  contactFromCreated,
  type JobContactRef,
} from '@/components/forms/JobContactsPicker';
import { addJobContactsAction } from '@/app/(app)/jobs/mutations';
import type { Contact } from '@/types/api';

export type ExistingJobContact = {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  mobilePhone?: string;
};

function toJobContactRef(contact: ExistingJobContact, index: number): JobContactRef {
  const contactId = contact.id?.trim() || undefined;
  let firstName = contact.firstName?.trim();
  let lastName = contact.lastName?.trim() || undefined;
  if (!firstName && contact.name?.trim()) {
    const [first, ...rest] = contact.name.trim().split(/\s+/);
    firstName = first;
    lastName = rest.join(' ') || lastName;
  }
  return {
    key: contactId ? `existing-${contactId}` : `existing-idx-${index}`,
    contactId,
    firstName: firstName || 'Contact',
    lastName,
    email: contact.email?.trim() || undefined,
    mobilePhone: contact.mobilePhone?.trim() || undefined,
  };
}

function contactDisplayName(contact: JobContactRef): string {
  return [contact.firstName, contact.lastName].filter(Boolean).join(' ');
}

export interface AddJobContactsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  /** Contacts already linked to the job — shown in a read-only panel. */
  existingContacts?: ExistingJobContact[];
  aiAssistEnabled?: boolean;
}

export function AddJobContactsDrawer({
  open,
  onOpenChange,
  jobId,
  existingContacts = [],
  aiAssistEnabled,
}: AddJobContactsDrawerProps) {
  const router = useRouter();
  const [newContacts, setNewContacts] = useState<JobContactRef[]>([]);
  const [linkedContacts, setLinkedContacts] = useState<JobContactRef[]>([]);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setNewContacts([]);
      setLinkedContacts([]);
      setExcludeIds([]);
      setContactDrawerOpen(false);
      setSubmitting(false);
      setError(null);
      return;
    }

    // Capture existing contacts once on open so parent re-renders don't reset staged adds.
    const linked = existingContacts.map(toJobContactRef);
    setLinkedContacts(linked);
    setExcludeIds(
      linked
        .map((c) => c.contactId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    );
    setNewContacts([]);
    setContactDrawerOpen(false);
    setSubmitting(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- capture existingContacts at open time
  }, [open]);

  function handleOpenChange(next: boolean) {
    // Keep this drawer open while the nested contact drawer is visible
    // (e.g. Escape would otherwise close both).
    if (!next && contactDrawerOpen) return;
    onOpenChange(next);
  }

  function addContact(contact: JobContactRef) {
    setNewContacts((prev) => {
      if (contact.contactId) {
        if (excludeIds.includes(contact.contactId)) return prev;
        if (prev.some((c) => c.contactId === contact.contactId)) return prev;
      }
      return [contact, ...prev];
    });
    setError(null);
  }

  function handleContactCreated(contact: Contact) {
    addContact(contactFromCreated(contact));
  }

  function removeContact(key: string) {
    setNewContacts((prev) => prev.filter((c) => c.key !== key));
  }

  async function handleSubmit() {
    if (newContacts.length === 0) {
      setError('Add at least one new contact, or cancel.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await addJobContactsAction(
        jobId,
        newContacts.map((c) =>
          c.contactId
            ? { contactId: c.contactId }
            : {
                firstName: c.firstName,
                lastName: c.lastName,
                email: c.email,
                mobilePhone: c.mobilePhone,
              },
        ),
      );
      if (result.success) {
        handleOpenChange(false);
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to add contacts');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contacts');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <BottomFormDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title="Add Contact"
        description="Search existing contacts or create a new one to attach to this job."
        icon={<Users className="h-5 w-5" />}
        aiAssistEnabled={aiAssistEnabled}
      >
        <BottomFormDrawerBody>
          <div className="space-y-6">
            <JobContactsPicker
              contacts={newContacts}
              onAdd={addContact}
              onRemove={removeContact}
              onNewContact={() => setContactDrawerOpen(true)}
              excludeIds={excludeIds}
              description="Search existing contacts or add a new one."
              newContactLabel="Create New Contact"
              contactsListClassName="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
              contactItemClassName="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm"
            />

            {linkedContacts.length > 0 && (
              <div className="space-y-2 pt-10">
                <h3 className="text-sm font-medium">Existing Contacts</h3>
                <p className="text-sm text-muted-foreground">
                  Already linked to this job. They will not be added again.
                </p>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {linkedContacts.map((c) => (
                    <li
                      key={c.key}
                      className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <div className="font-medium">{contactDisplayName(c)}</div>
                      {(c.email || c.mobilePhone) && (
                        <div className="mt-0.5 flex flex-col gap-0.5 break-all text-muted-foreground">
                          {c.email && <span>{c.email}</span>}
                          {c.mobilePhone && <span>{c.mobilePhone}</span>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={submitting || newContacts.length === 0}
            onClick={handleSubmit}
          >
            {submitting ? 'Adding...' : 'Add contacts'}
          </Button>
        </BottomFormDrawerFooter>
      </BottomFormDrawer>

      <ContactFormDrawer
        open={contactDrawerOpen}
        onOpenChange={setContactDrawerOpen}
        onSuccess={handleContactCreated}
      />
    </>
  );
}
