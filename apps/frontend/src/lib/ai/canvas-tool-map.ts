/** Maps AI tool names to drawer registry component keys. */
export const CANVAS_TOOL_COMPONENT_MAP: Record<string, string> = {
  open_quote_form: 'QuoteFormDrawer',
  create_quote: 'QuoteFormDrawer',
  open_task_form: 'TaskFormDrawer',
  create_task: 'TaskFormDrawer',
  open_contact_form: 'ContactFormDrawer',
  create_contact: 'ContactFormDrawer',
  open_assessment_building: 'AssessmentBuildingDrawer',
  open_assessment_general: 'AssessmentGeneralDrawer',
  open_assessment_hazards: 'AssessmentHazardsDrawer',
  open_assessment_accommodation: 'AssessmentAccommodationDrawer',
  open_assessment_other: 'AssessmentOtherDrawer',
};

export function resolveCanvasComponent(toolName: string): string | null {
  return CANVAS_TOOL_COMPONENT_MAP[toolName] ?? null;
}
