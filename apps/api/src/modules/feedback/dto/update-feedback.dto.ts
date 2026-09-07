import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
} from 'class-validator';

const PRIORITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

export class UpdateFeedbackDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsIn(PRIORITY_LEVELS)
  priority?: (typeof PRIORITY_LEVELS)[number];

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
