'use client';

import { useState } from 'react';
import { MapPin, Paperclip, Image as ImageIcon, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { JournalPage } from '@/types/api';

export interface PageTimelineProps {
  pages: JournalPage[];
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function groupByDate(pages: JournalPage[]): Map<string, JournalPage[]> {
  const groups = new Map<string, JournalPage[]>();
  for (const page of pages) {
    const key = new Date(page.capturedAt).toDateString();
    const existing = groups.get(key) ?? [];
    existing.push(page);
    groups.set(key, existing);
  }
  return groups;
}

export function PageTimeline({ pages }: PageTimelineProps) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const grouped = groupByDate(pages);

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
        <p className="text-sm">No entries yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([dateKey, dayPages]) => (
        <div key={dateKey} className="space-y-3">
          <div className="sticky top-0 z-10 bg-background/95 py-1 backdrop-blur">
            <Badge variant="outline" className="text-xs font-normal">
              {formatDate(dayPages[0].capturedAt)}
            </Badge>
          </div>

          <div className="relative space-y-3 border-l-2 border-muted pl-4">
            {dayPages.map((page) => (
              <div key={page.id} className="relative">
                <div className="absolute -left-[calc(1rem+5px)] top-2 size-2 rounded-full bg-primary" />

                <Card>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      <span>{formatTime(page.capturedAt)}</span>
                      {page.locationLabel && (
                        <>
                          <MapPin className="ml-2 size-3" />
                          <span>{page.locationLabel}</span>
                        </>
                      )}
                      {page.latitude && !page.locationLabel && (
                        <>
                          <MapPin className="ml-2 size-3" />
                          <span>
                            {Number(page.latitude).toFixed(4)}, {Number(page.longitude).toFixed(4)}
                          </span>
                        </>
                      )}
                    </div>

                    {page.body && (
                      <p className="whitespace-pre-wrap text-sm">{page.body}</p>
                    )}

                    {page.attachments && page.attachments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {page.attachments
                            .filter((a) => a.mimeType.startsWith('image/'))
                            .map((att) => (
                              <button
                                key={att.id}
                                type="button"
                                className="group relative h-24 overflow-hidden rounded-md bg-muted"
                                onClick={() => setExpandedImage(att.fileUrl ?? att.storageKey)}
                              >
                                <img
                                  src={att.fileUrl ?? `/api/files/${att.storageKey}`}
                                  alt={att.caption ?? att.fileName}
                                  className="size-full object-cover transition-transform group-hover:scale-105"
                                />
                                {att.caption && (
                                  <span className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-[10px] text-white">
                                    {att.caption}
                                  </span>
                                )}
                              </button>
                            ))}
                        </div>

                        {page.attachments.filter((a) => !a.mimeType.startsWith('image/')).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {page.attachments
                              .filter((a) => !a.mimeType.startsWith('image/'))
                              .map((att) => (
                                <Badge key={att.id} variant="secondary" className="gap-1 text-xs">
                                  <Paperclip className="size-3" />
                                  {att.fileName}
                                </Badge>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      ))}

      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Expanded"
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
        </div>
      )}
    </div>
  );
}
