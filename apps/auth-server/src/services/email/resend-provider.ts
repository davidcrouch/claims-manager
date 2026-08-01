import { Resend } from 'resend';
import { createLogger, LoggerType } from '../../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import type { EmailProvider, SendEmailParams, SendEmailResult } from './types.js';

const baseLogger = createLogger('auth-server:email:resend-provider', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'email', 'ResendProvider', 'auth-server');

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend' as const;
  private client: Resend;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('auth-server:email:resend-provider:constructor - Resend API key is required');
    }
    this.client = new Resend(apiKey);
    log.info({}, 'auth-server:email:resend-provider:constructor - Resend client created');
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    log.info(
      { to: params.to, subject: params.subject },
      'auth-server:email:resend-provider:send - Sending email via Resend',
    );

    const { data, error } = await this.client.emails.send({
      from: params.from || 'noreply@ensureos.com',
      to: params.to,
      replyTo: params.replyTo,
      subject: params.subject,
      html: params.html,
      text: params.text,
      tags: params.tags,
    });

    if (error) {
      log.error(
        { error: error.message, to: params.to },
        'auth-server:email:resend-provider:send - Failed to send email',
      );
      throw new Error(`Resend email failed: ${error.message}`);
    }

    log.info(
      { id: data?.id, to: params.to },
      'auth-server:email:resend-provider:send - Email sent successfully',
    );

    return { id: data?.id, provider: 'resend' };
  }
}
