import { z } from 'zod';

export const TaskSourceSchema = z.object({
  company_name: z.string(),
  task_name: z.string(),
  description: z.string(),
  status: z.string(),
  priority: z.string(),
  due_date: z.string(),
  completed_at: z.string(),
  report_date: z.string(),
});
