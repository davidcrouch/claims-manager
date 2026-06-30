'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { fetchScheduleEventsAction } from '@/app/(app)/schedule/actions';
import type { ScheduleEvent, ScheduleEventType } from '@/types/api';

type ViewMode = 'month' | 'week' | 'day';

const VIEW_LABELS: Record<ViewMode, string> = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
};

const EVENT_COLORS: Record<ScheduleEventType, { dot: string; bg: string; text: string }> = {
  appointment:    { dot: 'bg-blue-500',    bg: 'bg-blue-50 border-blue-200',    text: 'text-blue-700' },
  task:           { dot: 'bg-amber-500',   bg: 'bg-amber-50 border-amber-200',  text: 'text-amber-700' },
  work_order:     { dot: 'bg-purple-500',  bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
  purchase_order: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  rfq:            { dot: 'bg-cyan-500',    bg: 'bg-cyan-50 border-cyan-200',    text: 'text-cyan-700' },
  bill:           { dot: 'bg-rose-500',    bg: 'bg-rose-50 border-rose-200',    text: 'text-rose-700' },
  quote:          { dot: 'bg-indigo-500',  bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
};

const EVENT_LABELS: Record<ScheduleEventType, string> = {
  appointment: 'Appointments',
  task: 'Tasks',
  work_order: 'Work Orders',
  purchase_order: 'Purchase Orders',
  rfq: 'RFQs',
  bill: 'Bills',
  quote: 'Quotes',
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

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateRange(cursor: Date, view: ViewMode): { from: string; to: string } {
  if (view === 'month') {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const gridStart = new Date(first);
    gridStart.setDate(gridStart.getDate() - startDay);
    const gridEnd = new Date(gridStart);
    gridEnd.setDate(gridEnd.getDate() + 42);
    return { from: gridStart.toISOString(), to: gridEnd.toISOString() };
  }
  if (view === 'week') {
    const start = new Date(cursor);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  const start = new Date(cursor);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function buildEventMap(events: ScheduleEvent[]): Map<string, ScheduleEvent[]> {
  const map = new Map<string, ScheduleEvent[]>();
  for (const ev of events) {
    if (!ev.startsAt) continue;
    const d = new Date(ev.startsAt);
    const key = dateKey(d);
    const list = map.get(key);
    if (list) list.push(ev);
    else map.set(key, [ev]);
  }
  return map;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS_IN_CELL = 3;

function EventChip({ event }: { event: ScheduleEvent }) {
  const colors = EVENT_COLORS[event.eventType] ?? EVENT_COLORS.task;
  return (
    <div
      className={`flex items-center gap-1 truncate rounded border px-1 py-0.5 text-[10px] leading-tight ${colors.bg} ${colors.text}`}
      title={`${event.title} (${event.eventType.replace('_', ' ')})`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colors.dot}`} />
      <span className="truncate">{event.title}</span>
    </div>
  );
}

function EventBar({ event }: { event: ScheduleEvent }) {
  const colors = EVENT_COLORS[event.eventType] ?? EVENT_COLORS.task;
  const time = event.startsAt
    ? new Date(event.startsAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';
  return (
    <div
      className={`flex items-center gap-1.5 truncate rounded border px-2 py-1 text-xs ${colors.bg} ${colors.text}`}
      title={`${event.title} (${event.eventType.replace('_', ' ')})`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} />
      <span className="truncate font-medium">{event.title}</span>
      {time && <span className="ml-auto shrink-0 text-[10px] opacity-70">{time}</span>}
    </div>
  );
}

export function ScheduleClient({ jobId }: { jobId?: string } = {}) {
  const [view, setView] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hiddenTypes, setHiddenTypes] = useState<Set<ScheduleEventType>>(new Set());

  const { from, to } = useMemo(() => getDateRange(cursor, view), [cursor, view]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchScheduleEventsAction({ from, to, jobId, limit: 1000 });
      setEvents(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [from, to, jobId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredEvents = useMemo(
    () => hiddenTypes.size === 0 ? events : events.filter((ev) => !hiddenTypes.has(ev.eventType)),
    [events, hiddenTypes],
  );

  const eventMap = useMemo(() => buildEventMap(filteredEvents), [filteredEvents]);

  const toggleType = (type: ScheduleEventType) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const label =
    view === 'month'
      ? monthLabel(cursor)
      : view === 'week'
        ? weekLabel(cursor)
        : dayLabel(cursor);

  const cells = view === 'month' ? buildMonthGrid(cursor) : [];
  const curMonth = cursor.getMonth();

  const visibleTypes = useMemo(() => {
    const types = new Set<ScheduleEventType>();
    for (const ev of events) types.add(ev.eventType);
    return types;
  }, [events]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      {!jobId && (
        <SetPageHeader>
          <ListPageHeader
            icon={Calendar}
            title="Schedule"
            total={total}
            accent="slate"
          />
        </SetPageHeader>
      )}

      <div className={`flex flex-col gap-4 ${jobId ? 'pb-4' : 'px-6 pb-4 pt-1'}`}>
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
            {loading && (
              <span className="ml-2 text-xs text-slate-400">Loading…</span>
            )}
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

      <div className={`flex-1 ${jobId ? 'pb-6' : 'px-6 pb-6'}`} style={{ minHeight: 0, overflow: 'auto' }}>
        {view === 'month' && (
          <MonthView cells={cells} curMonth={curMonth} eventMap={eventMap} />
        )}
        {view === 'week' && (
          <WeekView cursor={cursor} eventMap={eventMap} />
        )}
        {view === 'day' && (
          <DayView cursor={cursor} events={eventMap.get(dateKey(cursor)) ?? []} />
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {(Object.keys(EVENT_COLORS) as ScheduleEventType[])
            .filter((type) => visibleTypes.has(type))
            .map((type) => {
              const hidden = hiddenTypes.has(type);
              const colors = EVENT_COLORS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition-colors ${
                    hidden
                      ? 'border-slate-200 bg-white text-slate-400 line-through'
                      : `${colors.bg} ${colors.text}`
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${hidden ? 'bg-slate-300' : colors.dot}`} />
                  {EVENT_LABELS[type]}
                </button>
              );
            })}
          {visibleTypes.size === 0 && !loading && (
            <span className="text-slate-400">No events in this period.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function MonthView({
  cells,
  curMonth,
  eventMap,
}: {
  cells: Date[];
  curMonth: number;
  eventMap: Map<string, ScheduleEvent[]>;
}) {
  return (
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
          const dayEvents = eventMap.get(dateKey(d)) ?? [];
          const overflow = dayEvents.length - MAX_CHIPS_IN_CELL;
          return (
            <div
              key={i}
              className={`min-h-[90px] border-b border-r border-slate-100 p-1.5 ${
                isCurrentMonth ? 'bg-white' : 'bg-slate-50/50'
              }`}
            >
              <span
                className={`mb-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday
                    ? 'bg-blue-600 font-semibold text-white'
                    : isCurrentMonth
                      ? 'text-slate-700'
                      : 'text-slate-400'
                }`}
              >
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, MAX_CHIPS_IN_CELL).map((ev) => (
                  <EventChip key={ev.id} event={ev} />
                ))}
                {overflow > 0 && (
                  <span className="px-1 text-[10px] text-slate-400">
                    +{overflow} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  cursor,
  eventMap,
}: {
  cursor: Date;
  eventMap: Map<string, ScheduleEvent[]>;
}) {
  const weekStart = new Date(cursor);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((dayName, i) => {
          const day = new Date(weekStart);
          day.setDate(day.getDate() + i);
          const isToday = day.toDateString() === new Date().toDateString();
          const dayEvents = eventMap.get(dateKey(day)) ?? [];
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
                  {day.getDate()}
                </div>
              </div>
              <div className="min-h-[300px] space-y-1 p-1.5">
                {dayEvents.length > 0 ? (
                  dayEvents.map((ev) => (
                    <EventBar key={ev.id} event={ev} />
                  ))
                ) : (
                  <p className="pt-2 text-center text-[10px] text-slate-300">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({
  cursor,
  events,
}: {
  cursor: Date;
  events: ScheduleEvent[];
}) {
  const hourBuckets = useMemo(() => {
    const buckets = new Map<number, ScheduleEvent[]>();
    for (const ev of events) {
      if (!ev.startsAt) continue;
      const hour = new Date(ev.startsAt).getHours();
      const clamped = Math.max(7, Math.min(hour, 18));
      const list = buckets.get(clamped);
      if (list) list.push(ev);
      else buckets.set(clamped, [ev]);
    }
    return buckets;
  }, [events]);

  const allDayEvents = useMemo(
    () => events.filter((ev) => {
      if (!ev.startsAt) return true;
      const d = new Date(ev.startsAt);
      return d.getHours() === 0 && d.getMinutes() === 0;
    }),
    [events],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-center">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {cursor.toLocaleDateString(undefined, { weekday: 'long' })}
        </div>
        <div className="mt-0.5 text-lg font-semibold text-slate-700">
          {cursor.getDate()}
        </div>
      </div>

      {allDayEvents.length > 0 && (
        <div className="border-b border-slate-200 bg-slate-50/50 px-4 py-2">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            All day
          </div>
          <div className="space-y-1">
            {allDayEvents.map((ev) => (
              <EventBar key={ev.id} event={ev} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-0">
        {Array.from({ length: 12 }, (_, i) => i + 7).map((hour) => {
          const bucket = hourBuckets.get(hour) ?? [];
          return (
            <div
              key={hour}
              className="flex min-h-[48px] border-b border-slate-100"
            >
              <div className="w-16 shrink-0 border-r border-slate-100 px-2 py-1 text-right text-xs text-slate-400">
                {hour.toString().padStart(2, '0')}:00
              </div>
              <div className="flex-1 space-y-0.5 p-1">
                {bucket.map((ev) => (
                  <EventBar key={ev.id} event={ev} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
