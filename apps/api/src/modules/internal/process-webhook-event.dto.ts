import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ProcessWebhookEventDto {
  @IsUUID()
  @IsString()
  @IsNotEmpty()
  eventId!: string;
}
