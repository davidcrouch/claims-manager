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

export interface AddJobContactsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  /** Contacts already linked to the job — shown when the drawer opens. */
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
  const [contacts, setContacts] = useState<JobContactRef[]>([]);
  const [lockedKeys, setLockedKeys] = useState<ReadonlySet<string>>(new Set());
  const [initialContactIds, setInitialContactIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setContacts([]);
      setLockedKeys(new Set());
      setInitialContactIds(new Set());
      setContactDrawerOpen(false);
      setSubmitting(false);
      setError(null);
      return;
    }

    // Seed once when the drawer opens so parent re-renders don't reset staged adds.
    const seeded = existingContacts.map(toJobContactRef);
    setContacts(seeded);
    setLockedKeys(new Set(seeded.map((c) => c.key)));
    setInitialContactIds(
      new Set(
        seeded
          .map((c) => c.contactId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    setContactDrawerOpen(false);
    setSubmitting(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- capture existingContacts at open time
  }, [open]);

  const newlyAdded = contacts.filter(
    (c) => !c.contactId || !initialContactIds.has(c.contactId),
  );

  function handleOpenChange(next: boolean) {
    // Keep this drawer open while the nested contact drawer is visible
    // (e.g. Escape would otherwise close both).
    if (!next && contactDrawerOpen) return;
    onOpenChange(next);
  }

  function addContact(contact: JobContactRef) {
    setContacts((prev) => {
      if (contact.contactId && prev.some((c) => c.contactId === contact.contactId)) {
        return prev;
      }
      // Newly selected/created contacts appear at the top of the list.
      return [contact, ...prev];
    });
    setError(null);
  }

  function handleContactCreated(contact: Contact) {
    addContact(contactFromCreated(contact));
  }

  function removeContact(key: string) {
    if (lockedKeys.has(key)) return;
    setContacts((prev) => prev.filter((c) => c.key !== key));
  }

  async function handleSubmit() {
    if (newlyAdded.length === 0) {
      setError('Add at least one new contact, or cancel.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await addJobContactsAction(
        jobId,
        newlyAdded.map((c) =>
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
          <JobContactsPicker
            contacts={contacts}
            onAdd={addContact}
            onRemove={removeContact}
            onNewContact={() => setContactDrawerOpen(true)}
            lockedKeys={lockedKeys}
            description="Search existing contacts or add a new one."
            newContactLabel="Create New Contact"
          />
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
            disabled={submitting || newlyAdded.length === 0}
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
