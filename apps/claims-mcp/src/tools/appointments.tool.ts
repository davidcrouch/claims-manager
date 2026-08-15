import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';
import { z } from 'zod';

const CAT = 'operations' as const;

export function registerAppointmentsTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_appointments',
    description: 'List appointments with filters and pagination.',
    path: '/appointments',
    input: {
      ...pageLimit,
      search: z.string().optional().describe('Search text'),
      status: z.string().optional().describe('Filter by status'),
      sort: z.string().optional().describe('Sort field'),
      order: z.enum(['asc', 'desc']).optional().describe('Sort order'),
      jobId: z.string().optional().describe('Filter by job UUID'),
    },
    query: (args) => ({
      page: args.page as number | undefined,
      limit: args.limit as number | undefined,
      search: args.search as string | undefined,
      status: args.status as string | undefined,
      sort: args.sort as string | undefined,
      order: args.order as string | undefined,
      jobId: args.jobId as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_appointment',
    description: 'Get a single appointment by ID.',
    path: '/appointments/{id}',
    input: {
      id: z.string().describe('Appointment UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_appointment',
    description: 'Create a new appointment.',
    method: 'POST',
    path: '/appointments',
    input: {
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_appointment',
    description: 'Update an existing appointment.',
    method: 'POST',
    path: '/appointments/{id}',
    input: {
      id: z.string().describe('Appointment UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'cancel_appointment',
    description: 'Cancel an appointment.',
    method: 'POST',
    path: '/appointments/{id}/cancel',
    input: {
      id: z.string().describe('Appointment UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_appointments_by_job',
    description: 'List appointments for a job.',
    path: '/appointments/job/{jobId}',
    input: {
      jobId: z.string().describe('Job UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_schedule_events',
    description: 'List schedule events (appointments and related) in a date range.',
    path: '/schedule/events',
    input: {
      from: z.string().describe('Range start (ISO date string, required)'),
      to: z.string().describe('Range end (ISO date string, required)'),
      eventType: z.string().optional().describe('Comma-separated event types'),
      jobId: z.string().optional().describe('Filter by job UUID'),
      limit: z.number().int().positive().optional().describe('Max results'),
    },
    query: (args) => ({
      from: args.from as string,
      to: args.to as string,
      eventType: args.eventType as string | undefined,
      jobId: args.jobId as string | undefined,
      limit: args.limit as number | undefined,
    }),
  });
}
