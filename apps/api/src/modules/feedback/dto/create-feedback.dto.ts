import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  IsObject,
  IsUUID,
} from 'class-validator';

const FEEDBACK_TYPES = ['bug', 'feature_request', 'enhancement', 'question', 'comment'] as const;
const PRIORITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

export class CreateFeedbackDto {
  @IsIn(FEEDBACK_TYPES)
  type!: (typeof FEEDBACK_TYPES)[number];

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsIn(PRIORITY_LEVELS)
  priority?: (typeof PRIORITY_LEVELS)[number];

  @IsOptional()
  @IsString()
  relatedEntityType?: string;

  @IsOptional()
  @IsUUID()
  relatedEntityId?: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  pageContext?: {
    pathname?: string;
    section?: string;
    entityType?: string;
    entityId?: string;
    jobId?: string;
    pageLabel?: string;
    adminArea?: string;
    activeTab?: string;
  };

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
