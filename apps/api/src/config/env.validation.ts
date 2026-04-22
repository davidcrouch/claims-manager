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
