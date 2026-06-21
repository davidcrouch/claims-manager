import { IsString, IsUUID, IsIn } from 'class-validator';

export class LinkJournalDto {
  @IsIn(['Job', 'Quote', 'Invoice'])
  entityType!: string;

  @IsUUID()
  entityId!: string;
}
