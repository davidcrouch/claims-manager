import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResendEmailProvider } from './providers/resend.provider';
import { ConsoleEmailProvider } from './providers/console.provider';
import type { EmailProvider, SendEmailParams, SendEmailResult } from './email.types';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private provider: EmailProvider;
  private readonly defaultFrom: string;
  private readonly defaultReplyTo: string | undefined;

  constructor(private readonly configService: ConfigService) {
    const providerName = this.configService.get<string>('EMAIL_PROVIDER', 'console');
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');

    this.defaultFrom = this.configService.get<string>('EMAIL_FROM', 'noreply@ensureos.com');
    this.defaultReplyTo = this.configService.get<string>('EMAIL_REPLY_TO') || undefined;

    if (providerName === 'resend' && resendApiKey) {
      this.provider = new ResendEmailProvider(resendApiKey);
    } else {
      if (providerName === 'resend' && !resendApiKey) {
        this.logger.warn(
          'communications:email-service:constructor - EMAIL_PROVIDER=resend but RESEND_API_KEY missing, falling back to console',
        );
      }
      this.provider = new ConsoleEmailProvider();
    }

    this.logger.log(
      `communications:email-service:constructor - Provider: ${this.provider.name}`,
    );
  }

  get providerName(): string {
    return this.provider.name;
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const enrichedParams: SendEmailParams = {
      ...params,
      from: params.from || this.defaultFrom,
      replyTo: params.replyTo || this.defaultReplyTo,
    };

    this.logger.log(
      `communications:email-service:send - To: ${Array.isArray(params.to) ? params.to.join(', ') : params.to} | Subject: ${params.subject}`,
    );
    return this.provider.send(enrichedParams);
  }
}
