export type UploadStatus = 'queued' | 'uploading' | 'completing' | 'completed' | 'failed';

export interface UploadTask {
  id: string;
  file: File;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadUrl: string;
  documentId: string;
  storageKey: string;
  thumbnailUploadUrl?: string;
  thumbnailObjectPath?: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  categoryId?: string | null;
  relatedRecordType?: string;
  relatedRecordId?: string;
  pipelineStatus?: string | null;
}

export interface UploadUrlResponse {
  documentId: string;
  uploadUrl: string;
  storageKey: string;
  thumbnailUploadUrl?: string;
  thumbnailObjectPath?: string;
}

export interface BatchUploadUrlResponse {
  uploads: UploadUrlResponse[];
}
