'use client';

import { useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';

type ViewMode = 'month' | 'week' | 'day';

const VIEW_LABELS: Record<ViewMode, string> = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
};

function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function weekLabel(date: Date): string {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function navigate(date: Date, view: ViewMode, delta: number): Date {
  const next = new Date(date);
  if (view === 'month') next.setMonth(next.getMonth() + delta);
  else if (view === 'week') next.setDate(next.getDate() + 7 * delta);
  else next.setDate(next.getDate() + delta);
  return next;
}

function buildMonthGrid(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(gridStart.getDate() - startDay);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    cells.push(d);
  }
  return cells;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ScheduleClient() {
  const [view, setView] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(() => new Date());

  const label =
    view === 'month'
      ? monthLabel(cursor)
      : view === 'week'
        ? weekLabel(cursor)
        : dayLabel(cursor);

  const cells = view === 'month' ? buildMonthGrid(cursor) : [];
  const curMonth = cursor.getMonth();

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={Calendar}
          title="Schedule"
          total={0}
          accent="slate"
        />
      </SetPageHeader>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCursor((d) => navigate(d, view, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="min-w-[200px] text-center text-sm font-semibold">
              {label}
            </h2>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCursor((d) => navigate(d, view, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={() => setCursor(new Date())}
            >
              Today
            </Button>
          </div>

          <div className="flex items-center rounded-md border border-slate-200 bg-white p-1">
            {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === v
                    ? 'bg-slate-100 text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        {view === 'month' ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((d, i) => {
                const isCurrentMonth = d.getMonth() === curMonth;
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={i}
                    className={`min-h-[80px] border-b border-r border-slate-100 p-1.5 ${
                      isCurrentMonth ? 'bg-white' : 'bg-slate-50/50'
                    }`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        isToday
                          ? 'bg-blue-600 font-semibold text-white'
                          : isCurrentMonth
                            ? 'text-slate-700'
                            : 'text-slate-400'
                      }`}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : view === 'week' ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-7">
              {WEEKDAYS.map((dayName, i) => {
                const start = new Date(cursor);
                start.setDate(start.getDate() - start.getDay() + i);
                const isToday =
                  start.toDateString() === new Date().toDateString();
                return (
                  <div key={i} className="border-r border-slate-100 last:border-r-0">
                    <div
                      className={`border-b border-slate-200 px-2 py-3 text-center ${
                        isToday ? 'bg-blue-50' : 'bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {dayName}
                      </div>
                      <div
                        className={`mt-0.5 text-lg font-semibold ${
                          isToday ? 'text-blue-600' : 'text-slate-700'
                        }`}
                      >
                        {start.getDate()}
                      </div>
                    </div>
                    <div className="min-h-[300px] p-1.5">
                      <p className="text-center text-[10px] text-slate-300">—</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-center">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {cursor.toLocaleDateString(undefined, { weekday: 'long' })}
              </div>
              <div className="mt-0.5 text-lg font-semibold text-slate-700">
                {cursor.getDate()}
              </div>
            </div>
            <div className="space-y-0">
              {Array.from({ length: 12 }, (_, i) => i + 7).map((hour) => (
                <div
                  key={hour}
                  className="flex min-h-[48px] border-b border-slate-100"
                >
                  <div className="w-16 shrink-0 border-r border-slate-100 px-2 py-1 text-right text-xs text-slate-400">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  <div className="flex-1" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            Appointments
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            Task due dates
          </span>
          <span className="ml-auto text-slate-400">
            Events will appear once the calendar API is connected.
          </span>
        </div>
      </div>
    </div>
  );
}
