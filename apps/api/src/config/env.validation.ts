import { plainToInstance, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
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

  @IsUrl()
  @IsOptional()
  CRUNCHWORK_AUTH_URL?: string;

  @IsUrl()
  @IsOptional()
  CRUNCHWORK_BASE_URL?: string;

  @IsString()
  @IsOptional()
  CRUNCHWORK_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  CRUNCHWORK_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  CRUNCHWORK_HMAC_KEY?: string;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: true });
  if (errors.length > 0) {
    throw new Error(`[Config.validate] Invalid environment: ${errors.toString()}`);
  }
  return validated;
}
