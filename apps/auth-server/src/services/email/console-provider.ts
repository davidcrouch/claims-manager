import { createLogger, LoggerType } from '../../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import type { EmailProvider, SendEmailParams, SendEmailResult } from './types.js';

const baseLogger = createLogger('auth-server:email:console-provider', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'email', 'ConsoleProvider', 'auth-server');

export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console' as const;

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    log.info(
      {
        to: params.to,
        subject: params.subject,
        from: params.from,
      },
      'auth-server:email:console-provider:send - Email (console mode)',
    );

    log.debug(
      {
        to: params.to,
        subject: params.subject,
        from: params.from,
        replyTo: params.replyTo,
        html: params.html,
        text: params.text,
      },
      'auth-server:email:console-provider:send - Full email content',
    );

    return { provider: 'console' };
  }
}
