import { IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateScenarioConfigDto {
  @ApiPropertyOptional({
    description: 'Default output format when generating this document type.',
    enum: ['docx', 'pdf'],
  })
  @IsOptional()
  @IsIn(['docx', 'pdf'])
  outputFormat?: 'docx' | 'pdf';

  @ApiPropertyOptional({
    description:
      'Company filesystem category ID where completed reports for this type are saved. Null clears the folder setting.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  completedReportsFolderCategoryId?: string | null;

  @ApiPropertyOptional({
    description:
      'Project-template folder slug. Resolved against the current job filesystem at print time.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  completedReportsFolderSlug?: string | null;

  @ApiPropertyOptional({
    description: 'Whether the completed-reports folder is company or project-scoped.',
    enum: ['company', 'project'],
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(['company', 'project'])
  completedReportsFolderKind?: 'company' | 'project' | null;
}
