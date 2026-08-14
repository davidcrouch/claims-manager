'use client';

import { useMemo, useState, useTransition } from 'react';
import { Building2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddressAutocompleteInput } from '@/components/shared/AddressAutocompleteInput';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { updateOrganisationAction } from '@/app/(app)/admin/settings/actions';
import type { OrganisationProfile } from '@/types/api';

interface FormState {
  name: string;
  abn: string;
  primaryEmail: string;
  phone: string;
  address: string;
}

function toForm(org: OrganisationProfile): FormState {
  return {
    name: org.name ?? '',
    abn: org.abn ?? '',
    primaryEmail: org.primaryEmail ?? '',
    phone: org.phone ?? '',
    address: org.address ?? '',
  };
}

export interface SettingsPageClientProps {
  organisation: OrganisationProfile;
}

export function SettingsPageClient({ organisation }: SettingsPageClientProps) {
  const [saved, setSaved] = useState<FormState>(() => toForm(organisation));
  const [form, setForm] = useState<FormState>(() => toForm(organisation));
  const [isPending, startTransition] = useTransition();

  const isDirty = useMemo(
    () =>
      form.name !== saved.name ||
      form.abn !== saved.abn ||
      form.primaryEmail !== saved.primaryEmail ||
      form.phone !== saved.phone ||
      form.address !== saved.address,
    [form, saved],
  );

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCancel = () => {
    setForm(saved);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    startTransition(async () => {
      const result = await updateOrganisationAction({
        name: form.name,
        abn: form.abn,
        primaryEmail: form.primaryEmail,
        phone: form.phone,
        address: form.address,
      });
      if (!result.success || !result.organisation) {
        toast.error(result.error ?? 'Failed to save company details');
        return;
      }
      const next = toForm(result.organisation);
      setSaved(next);
      setForm(next);
      toast.success('Company details saved');
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={Building2}
          title="Company"
          total={0}
          accent="slate"
        />
      </SetPageHeader>
      <SetHeaderActions>
        <Button
          size="default"
          variant="outline"
          onClick={handleCancel}
          disabled={!isDirty || isPending}
          className="h-9 gap-1.5 px-4"
        >
          Cancel
        </Button>
        <Button
          size="default"
          onClick={handleSave}
          disabled={!isDirty || isPending}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          <Save className="h-3.5 w-3.5" />
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </SetHeaderActions>

      <div className="flex-1 px-6 pb-6 pt-4" style={{ minHeight: 0, overflow: 'auto' }}>
        <div className="space-y-4">
          <Card className="overflow-visible">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Company details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company name</Label>
                  <Input
                    id="company-name"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="Your company name"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-abn">ABN / Business number</Label>
                  <Input
                    id="company-abn"
                    value={form.abn}
                    onChange={(e) => updateField('abn', e.target.value)}
                    placeholder="Business registration number"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-email">Contact email</Label>
                  <Input
                    id="company-email"
                    type="email"
                    value={form.primaryEmail}
                    onChange={(e) => updateField('primaryEmail', e.target.value)}
                    placeholder="admin@example.com"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-phone">Phone</Label>
                  <Input
                    id="company-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="+61 ..."
                    disabled={isPending}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-location">Address</Label>
                <AddressAutocompleteInput
                  id="company-location"
                  value={form.address}
                  onChange={(value) => updateField('address', value)}
                  placeholder="Start typing a street address…"
                  disabled={isPending}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
