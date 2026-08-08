export type ArtifactContentType = 'markdown' | 'code' | 'json' | 'html' | 'image';

export type ArtifactExportScope = 'company' | 'project';

/**
 * Company scope: `defaultCategoryId` / content-type values are category UUIDs.
 * Project scope: same field names hold category **slugs** (stable across job FS copies).
 */
export interface ArtifactExportSettings {
  defaultCategoryId?: string | null;
  categoryByContentType?: Partial<Record<ArtifactContentType, string>>;
  fileNameTemplate?: string;
}

export interface UpdateArtifactExportSettingsDto extends ArtifactExportSettings {
  scope?: ArtifactExportScope;
  /** When saving project settings before org default template is persisted. */
  templateId?: string;
}
