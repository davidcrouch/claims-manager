import { z } from 'zod';

export const ListEnvelopeSchema = z.object({
  company_name: z.string(),
  report_title: z.string(),
  report_date: z.string(),
  total_count: z.string(),
});

export const GroupItemSchema = z.object({
  item_name: z.string(),
  item_description: z.string(),
  item_category: z.string(),
  item_quantity: z.string(),
  item_unit_cost: z.string(),
  item_tax: z.string(),
  item_total: z.string(),
  item_note: z.string(),
});

export const ComboSchema = z.object({
  combo_name: z.string(),
  combo_description: z.string(),
  combo_quantity: z.string(),
  combo_subtotal: z.string(),
  combo_note: z.string(),
  items: z.array(GroupItemSchema),
});

export const ScopeSchema = z.object({
  scope_name: z.string(),
  scope_description: z.string(),
  scope_quantity: z.string(),
  scope_subtotal: z.string(),
  scope_note: z.string(),
  items: z.array(GroupItemSchema),
  combos: z.array(ComboSchema),
});

export const GroupSchema = z.object({
  group_name: z.string(),
  group_note: z.string(),
  group_subtotal: z.string(),
  items: z.array(GroupItemSchema),
  combos: z.array(ComboSchema),
  scopes: z.array(ScopeSchema),
});
