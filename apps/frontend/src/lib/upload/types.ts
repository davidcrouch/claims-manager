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
  status: UploadStatus;
  progress: number;
  error?: string;
  categoryId?: string | null;
  relatedRecordType?: string;
  relatedRecordId?: string;
}

export interface UploadUrlResponse {
  documentId: string;
  uploadUrl: string;
  storageKey: string;
}

export interface BatchUploadUrlResponse {
  uploads: UploadUrlResponse[];
}
