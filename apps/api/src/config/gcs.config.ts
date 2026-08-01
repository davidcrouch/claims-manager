import { registerAs } from '@nestjs/config';

export default registerAs('gcs', () => ({
  projectId: process.env.GCP_PROJECT_ID || '',
  documentsBucket: process.env.GCS_DOCUMENTS_BUCKET || '',
  uploadCorsOrigin: process.env.GCS_UPLOAD_CORS_ORIGIN || 'http://localhost:5002',
  downloadUrlExpiry: parseInt(process.env.GCS_DOWNLOAD_URL_EXPIRY || '900', 10),
}));
