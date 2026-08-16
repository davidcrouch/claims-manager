import { Injectable, Logger } from '@nestjs/common';
import type { EmailProvider, SendEmailParams, SendEmailResult } from '../email.types';

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);
  readonly name = 'console' as const;

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const to = Array.isArray(params.to) ? params.to.join(', ') : params.to;
    this.logger.log(
      `communications:console-provider:send - [CONSOLE] To: ${to} | Subject: ${params.subject} | Attachments: ${params.attachments?.length ?? 0}`,
    );
    return { id: `console-${Date.now()}`, provider: 'console', success: true };
  }
}
