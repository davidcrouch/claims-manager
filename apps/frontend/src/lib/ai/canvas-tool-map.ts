/** Maps AI tool names to drawer registry component keys. */
export const CANVAS_TOOL_COMPONENT_MAP: Record<string, string> = {
  open_quote_form: 'QuoteFormDrawer',
  create_quote: 'QuoteFormDrawer',
  open_task_form: 'TaskFormDrawer',
  create_task: 'TaskFormDrawer',
  open_contact_form: 'ContactFormDrawer',
  create_contact: 'ContactFormDrawer',
};

export function resolveCanvasComponent(toolName: string): string | null {
  return CANVAS_TOOL_COMPONENT_MAP[toolName] ?? null;
}
