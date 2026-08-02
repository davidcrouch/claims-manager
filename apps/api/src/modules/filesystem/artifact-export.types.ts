export type ArtifactContentType = 'markdown' | 'code' | 'json' | 'html' | 'image';

export interface ArtifactExportSettings {
  defaultCategoryId?: string | null;
  categoryByContentType?: Partial<Record<ArtifactContentType, string>>;
  fileNameTemplate?: string;
}
