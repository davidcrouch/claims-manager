import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GraphClient } from '../graph/graph-client.js';
import { requireAccessToken } from '../auth/token-extract.js';
import type { MsGraphConfig } from '../config.js';

interface CalendarEvent {
  id: string;
  subject: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: { displayName?: string };
  organizer?: { emailAddress?: { name?: string; address?: string } };
  attendees?: Array<{
    emailAddress?: { name?: string; address?: string };
    status?: { response?: string };
  }>;
  isOnlineMeeting?: boolean;
  onlineMeetingUrl?: string;
  bodyPreview?: string;
  isAllDay?: boolean;
  showAs?: string;
  importance?: string;
  recurrence?: unknown;
}

function formatEventSummary(event: CalendarEvent) {
  return {
    id: event.id,
    subject: event.subject,
    start: event.start?.dateTime,
    startTimeZone: event.start?.timeZone,
    end: event.end?.dateTime,
    endTimeZone: event.end?.timeZone,
    location: event.location?.displayName,
    organizer: event.organizer?.emailAddress?.address
      ? `${event.organizer.emailAddress.name ?? ''} <${event.organizer.emailAddress.address}>`
      : undefined,
    attendeeCount: event.attendees?.length ?? 0,
    isOnlineMeeting: event.isOnlineMeeting,
    isAllDay: event.isAllDay,
    showAs: event.showAs,
    bodyPreview: event.bodyPreview,
  };
}

function formatToolError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[calendar.tool] ${message}`);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

export function registerCalendarTools(server: McpServer, config: MsGraphConfig): void {
  server.tool(
    'list_events',
    'List upcoming calendar events within a time range. Defaults to the next 7 days if no range is specified.',
    {
      startDate: z.string().optional().describe("Start of time range (ISO 8601 format, e.g. '2024-01-15T00:00:00'). Defaults to now."),
      endDate: z.string().optional().describe('End of time range (ISO 8601 format). Defaults to 7 days from start.'),
      top: z.number().int().min(1).max(50).optional().describe('Maximum number of events to return (default: 20, max: 50)'),
    },
    async (params) => {
      try {
        const client = new GraphClient({ accessToken: requireAccessToken(), baseUrl: config.GRAPH_API_BASE_URL });

        const now = new Date();
        const startDateTime = params.startDate ?? now.toISOString();
        const endDateTime = params.endDate ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const top = params.top ?? 20;

        const data = await client.get<{ value: CalendarEvent[] }>('/me/calendarView', {
          startDateTime,
          endDateTime,
          $top: String(top),
          $orderby: 'start/dateTime',
          $select: 'id,subject,start,end,location,organizer,attendees,isOnlineMeeting,isAllDay,showAs,bodyPreview',
        });

        const events = (data.value ?? []).map(formatEventSummary);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ count: events.length, timeRange: { start: startDateTime, end: endDateTime }, events }, null, 2) }],
        };
      } catch (err) {
        return formatToolError(err);
      }
    },
  );

  server.tool(
    'get_event',
    'Get full details of a specific calendar event by its ID.',
    {
      eventId: z.string().describe('The ID of the calendar event'),
    },
    async (params) => {
      try {
        const client = new GraphClient({ accessToken: requireAccessToken(), baseUrl: config.GRAPH_API_BASE_URL });

        const event = await client.get<CalendarEvent>(
          `/me/events/${encodeURIComponent(params.eventId)}`,
          { $select: 'id,subject,start,end,location,organizer,attendees,isOnlineMeeting,onlineMeetingUrl,isAllDay,showAs,importance,recurrence' },
        );

        const attendeeList = (event.attendees ?? []).map((a) => ({
          email: a.emailAddress?.address,
          name: a.emailAddress?.name,
          response: a.status?.response,
        }));

        const result = {
          ...formatEventSummary(event),
          onlineMeetingUrl: event.onlineMeetingUrl,
          importance: event.importance,
          attendees: attendeeList,
          hasRecurrence: !!event.recurrence,
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return formatToolError(err);
      }
    },
  );
}
