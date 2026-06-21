'use client';

import { useState } from 'react';
import { Send, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { JournalPage } from '@/types/api';
import type { ApiClient } from '@/lib/api-client';

export interface PageEntryFormProps {
  journalId: string;
  api: ApiClient;
  onCreated?: (page: JournalPage) => void;
}

export function PageEntryForm({ journalId, api, onCreated }: PageEntryFormProps) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocationError(null);
      },
      (err) => {
        setLocationError(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    setSaving(true);
    try {
      const page = await api.createJournalPage(journalId, {
        body: body.trim(),
        bodyFormat: 'plaintext',
        latitude: location?.latitude,
        longitude: location?.longitude,
        locationAccuracy: location?.accuracy,
      });
      onCreated?.(page);
      setBody('');
    } catch (err) {
      console.error('PageEntryForm.handleSubmit:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-card p-4">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a journal entry..."
        rows={3}
        className="resize-none"
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={captureLocation}
            className={location ? 'text-green-600' : ''}
          >
            <MapPin className="mr-1 size-4" />
            {location ? 'Located' : 'Add Location'}
          </Button>
          {locationError && (
            <span className="text-xs text-destructive">{locationError}</span>
          )}
          {location && (
            <span className="text-xs text-muted-foreground">
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </span>
          )}
        </div>
        <Button type="submit" size="sm" disabled={saving || !body.trim()}>
          <Send className="mr-1 size-4" />
          {saving ? 'Saving...' : 'Add Entry'}
        </Button>
      </div>
    </form>
  );
}
