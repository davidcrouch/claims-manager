'use client';

import { Users, Mail, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Job } from '@/types/api';

type Dict = Record<string, unknown>;

interface ContactRow {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  mobilePhone?: string;
  homePhone?: string;
  workPhone?: string;
  type?: string | { name?: string; externalReference?: string };
  preferredMethodOfContact?: string | { name?: string };
  notes?: string;
}

function contactName(c: ContactRow): string {
  if (c.name) return c.name;
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.join(' ').trim() || '—';
}

function contactType(c: ContactRow): string {
  if (!c.type) return '—';
  if (typeof c.type === 'string') return c.type;
  return c.type.name ?? c.type.externalReference ?? '—';
}

function preferredMethod(c: ContactRow): string {
  if (!c.preferredMethodOfContact) return '—';
  if (typeof c.preferredMethodOfContact === 'string') {
    return c.preferredMethodOfContact;
  }
  return c.preferredMethodOfContact.name ?? '—';
}

export function JobPartiesTab({ job }: { job: Job }) {
  const api = (job.apiPayload as Dict | undefined) ?? {};
  const contacts = (api.contacts as ContactRow[] | undefined) ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          Contacts ({contacts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {contacts.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">
            No contacts linked to this job.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Phones</th>
                  <th className="px-4 py-2">Preferred</th>
                  <th className="px-4 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {contacts.map((c, i) => (
                  <tr key={c.id ?? i}>
                    <td className="px-4 py-2 font-medium">{contactName(c)}</td>
                    <td className="px-4 py-2">{contactType(c)}</td>
                    <td className="px-4 py-2">
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Mail className="h-3 w-3" />
                          {c.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col gap-0.5">
                        {c.mobilePhone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {c.mobilePhone}{' '}
                            <span className="text-muted-foreground">(M)</span>
                          </span>
                        )}
                        {c.homePhone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {c.homePhone}{' '}
                            <span className="text-muted-foreground">(H)</span>
                          </span>
                        )}
                        {c.workPhone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {c.workPhone}{' '}
                            <span className="text-muted-foreground">(W)</span>
                          </span>
                        )}
                        {!c.mobilePhone && !c.homePhone && !c.workPhone && '—'}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {preferredMethod(c)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {c.notes ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
