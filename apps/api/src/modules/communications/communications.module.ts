import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email/email.service';
import { EmailTemplateService } from './templates/email-template.service';

@Module({
  imports: [ConfigModule],
  providers: [EmailService, EmailTemplateService],
  exports: [EmailService, EmailTemplateService],
})
export class CommunicationsModule {}
