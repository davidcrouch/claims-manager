/**
 * Action descriptor attached to a task by the workflow engine.
 * Tells the frontend what UI to open when the user acts on this task.
 */
export interface TaskAction {
  /** Semantic action key — stable identifier, not a UI concept. */
  actionKey: string;
  /** Human-readable CTA button label. */
  label: string;
  /** Context the frontend needs to execute the action. */
  context: {
    entityType?: string;
    entityId?: string;
    jobId?: string;
    claimId?: string;
  };
}
