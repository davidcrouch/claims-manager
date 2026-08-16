import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import type { EmailProvider, SendEmailParams, SendEmailResult } from '../email.types';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);
  readonly name = 'resend' as const;
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
    this.logger.log('communications:resend-provider:constructor - Resend client initialised');
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

    this.logger.log(
      `communications:resend-provider:send - Sending to ${toAddresses.length} recipient(s)`,
    );

    try {
      const { data, error } = await this.client.emails.send({
        from: params.from || 'noreply@ensureos.com',
        to: toAddresses,
        replyTo: params.replyTo,
        subject: params.subject,
        html: params.html,
        text: params.text,
        attachments: params.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
        tags: params.tags,
      });

      if (error) {
        this.logger.error(
          `communications:resend-provider:send - Failed: ${error.message}`,
        );
        return { provider: 'resend', success: false, error: error.message };
      }

      this.logger.log(
        `communications:resend-provider:send - Success id=${data?.id}`,
      );
      return { id: data?.id, provider: 'resend', success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `communications:resend-provider:send - Exception: ${message}`,
      );
      return { provider: 'resend', success: false, error: message };
    }
  }
}
