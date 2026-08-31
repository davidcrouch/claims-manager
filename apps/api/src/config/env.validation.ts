import { plainToInstance, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  PORT?: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  MORE0_ENABLED?: string;

  @IsString()
  @IsOptional()
  MORE0_API_KEY?: string;

  @IsString()
  @IsOptional()
  MORE0_GATEWAY_URL?: string;

  @IsString()
  @IsOptional()
  MORE0_ORGANIZATION_ID?: string;

  @IsString()
  @IsOptional()
  WEBHOOK_PROCESSING_MODE?: string;

  @IsString()
  @IsOptional()
  WEBHOOK_INPROC_MAPPING_ENABLED?: string;

  @IsString()
  @IsOptional()
  S3_ENDPOINT?: string;

  @IsString()
  @IsOptional()
  S3_REGION?: string;

  @IsString()
  @IsOptional()
  S3_BUCKET_PAYLOADS?: string;

  @IsString()
  @IsOptional()
  S3_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  S3_SECRET_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  S3_FORCE_PATH_STYLE?: string;

  @IsString()
  @IsOptional()
  S3_ARCHIVE_PREFIX?: string;

  @IsString()
  @IsOptional()
  GCP_PROJECT_ID?: string;

  @IsString()
  @IsOptional()
  GCS_DOCUMENTS_BUCKET?: string;

  @IsString()
  @IsOptional()
  GCS_UPLOAD_CORS_ORIGIN?: string;

  @IsString()
  @IsOptional()
  GCS_DOWNLOAD_URL_EXPIRY?: string;

  @IsString()
  @IsOptional()
  PUBSUB_ENABLED?: string;

  @IsString()
  @IsOptional()
  INTERNAL_API_TOKEN?: string;

  @IsString()
  @IsOptional()
  SEED_NEW_TENANTS?: string;

  /** Optional Pub/Sub topic for async pipeline dispatch; sync in-process when unset. */
  @IsString()
  @IsOptional()
  PIPELINE_TOPIC_NAME?: string;

  @IsString()
  @IsOptional()
  VERTEX_LOCATION?: string;

  @IsString()
  @IsOptional()
  VERTEX_GEMINI_MODEL?: string;

  @IsString()
  @IsOptional()
  VERTEX_AI_PROJECT?: string;

  @IsString()
  @IsOptional()
  VERTEX_AI_LOCATION?: string;

  @IsString()
  @IsOptional()
  VERTEX_EMBEDDING_MODEL?: string;

  @IsString()
  @IsOptional()
  VERTEX_IMAGEN_MODEL?: string;

  @IsString()
  @IsOptional()
  VERTEX_IMAGEN_LOCATION?: string;

  @IsString()
  @IsOptional()
  VERTEX_IMAGE_FALLBACK_MODEL?: string;

  @IsString()
  @IsOptional()
  DEFAULT_CHAT_MODEL?: string;

  @IsString()
  @IsOptional()
  DEFAULT_CHAT_PROVIDER?: string;

  @IsString()
  @IsOptional()
  MCP_OAUTH_CALLBACK_BASE_URL?: string;

  @IsString()
  @IsOptional()
  CLAIMS_MCP_URL?: string;

  @IsString()
  @IsOptional()
  MS_GRAPH_MCP_URL?: string;

  @IsString()
  @IsOptional()
  GCP_SECRET_MANAGER_PROJECT?: string;

  @IsString()
  @IsOptional()
  AUTH_SERVER_URL?: string;

  @IsString()
  @IsOptional()
  AUTH_ISSUER_URL?: string;

  @IsString()
  @IsOptional()
  AUTH_JWKS_URI?: string;

  /** Comma-separated JWT audiences accepted by the API. Required in production. */
  @IsString()
  @IsOptional()
  AUTH_AUDIENCE?: string;

  /** Absolute path to soffice / soffice.exe for DOCX → PDF conversion. */
  @IsString()
  @IsOptional()
  LIBREOFFICE_PATH?: string;

  @IsString()
  @IsOptional()
  EMAIL_PROVIDER?: string;

  @IsString()
  @IsOptional()
  RESEND_API_KEY?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM?: string;

  @IsString()
  @IsOptional()
  EMAIL_REPLY_TO?: string;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: true });
  if (errors.length > 0) {
    throw new Error(
      `[Config.validate] Invalid environment: ${errors.toString()}`,
    );
  }
  return validated;
}
