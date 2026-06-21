import { IsUUID, ArrayMinSize } from 'class-validator';

export class ReorderPagesDto {
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  pageIds!: string[];
}
