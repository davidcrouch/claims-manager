import nodemailer from 'nodemailer';
import { createLogger, LoggerType } from '../../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import type { EmailProvider, EmailConfig, SendEmailParams, SendEmailResult } from './types.js';

const baseLogger = createLogger('auth-server:email:smtp-provider', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'email', 'SmtpProvider', 'auth-server');

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp' as const;
  private transporter: nodemailer.Transporter;

  constructor(config: EmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth:
        config.smtp.user && config.smtp.pass
          ? { user: config.smtp.user, pass: config.smtp.pass }
          : undefined,
    });

    log.info(
      { host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure },
      'auth-server:email:smtp-provider:constructor - SMTP transport created',
    );
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    log.info(
      { to: params.to, subject: params.subject },
      'auth-server:email:smtp-provider:send - Sending email via SMTP',
    );

    const info = await this.transporter.sendMail({
      from: params.from,
      to: params.to,
      replyTo: params.replyTo,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    log.info(
      { messageId: info.messageId, to: params.to },
      'auth-server:email:smtp-provider:send - Email sent successfully',
    );

    return { id: info.messageId, provider: 'smtp' };
  }
}
