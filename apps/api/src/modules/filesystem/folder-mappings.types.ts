export const FOLDER_MAPPING_ROLES = ['photos'] as const;

export type FolderMappingRole = (typeof FOLDER_MAPPING_ROLES)[number];

/**
 * Maps semantic roles to project-template category slugs.
 * Stored in `organizations.config.filesystem.projectFolderMappings`.
 */
export interface ProjectFolderMappings {
  photos?: string | null;
}

export interface UpdateProjectFolderMappingsDto extends ProjectFolderMappings {
  templateId?: string;
}

export interface ResolvedFolderMapping {
  filesystemId: string;
  categoryId: string;
  slug: string;
}
