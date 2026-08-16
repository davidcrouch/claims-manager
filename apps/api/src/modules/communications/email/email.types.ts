export type EmailProviderName = 'console' | 'smtp' | 'resend';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  id?: string;
  provider: EmailProviderName;
  success: boolean;
  error?: string;
}

export interface EmailProvider {
  readonly name: EmailProviderName;
  send(params: SendEmailParams): Promise<SendEmailResult>;
}
