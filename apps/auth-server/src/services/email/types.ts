export type EmailProviderName = 'console' | 'smtp' | 'resend';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  id?: string;
  provider: EmailProviderName;
}

export interface EmailProvider {
  readonly name: EmailProviderName;
  send(params: SendEmailParams): Promise<SendEmailResult>;
}

export interface EmailConfig {
  provider: EmailProviderName;
  from: string;
  replyTo?: string;
  resendApiKey?: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
  };
}
