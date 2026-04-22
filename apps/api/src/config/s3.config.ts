import { registerAs } from '@nestjs/config';

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export default registerAs('s3', () => ({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:3230',
  region: process.env.S3_REGION || 'us-east-1',
  bucket: process.env.S3_BUCKET_PAYLOADS || 'claims-manager',
  accessKeyId:
    process.env.S3_ACCESS_KEY_ID || process.env.MINIO_ROOT_USER || 'sail',
  secretAccessKey:
    process.env.S3_SECRET_ACCESS_KEY ||
    process.env.MINIO_ROOT_PASSWORD ||
    'password',
  forcePathStyle: parseBool(process.env.S3_FORCE_PATH_STYLE, true),
  archivePrefix: process.env.S3_ARCHIVE_PREFIX || 'webhooks/payloads',
}));
