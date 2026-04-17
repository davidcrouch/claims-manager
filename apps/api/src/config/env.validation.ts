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
  WEBHOOK_INPROC_MAPPING_ENABLED?: string;
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
