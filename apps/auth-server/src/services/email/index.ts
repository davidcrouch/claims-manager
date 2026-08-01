import React from 'react';
import { createLogger, LoggerType } from '../../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { getEmailConfig } from '../../config/env-validation.js';
import { ConsoleEmailProvider } from './console-provider.js';
import { SmtpEmailProvider } from './smtp-provider.js';
import { ResendEmailProvider } from './resend-provider.js';
import { renderEmailHtml } from './templates/render-email.js';
import { InviteEmail, inviteEmailText } from './templates/InviteEmail.js';
import { PasswordResetEmail, passwordResetEmailText } from './templates/PasswordResetEmail.js';
import type { EmailProvider, SendEmailParams, SendEmailResult, EmailConfig } from './types.js';

const baseLogger = createLogger('auth-server:email', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'email', 'EmailService', 'auth-server');

let cachedProvider: EmailProvider | null = null;

function getProvider(): EmailProvider {
  if (cachedProvider) return cachedProvider;

  const config = getEmailConfig() as EmailConfig;

  switch (config.provider) {
    case 'smtp':
      log.info({}, 'auth-server:email:getProvider - Initializing SMTP email provider');
      cachedProvider = new SmtpEmailProvider(config);
      break;
    case 'resend':
      if (!config.resendApiKey) {
        throw new Error('auth-server:email:getProvider - RESEND_API_KEY is required when provider is resend');
      }
      log.info({}, 'auth-server:email:getProvider - Initializing Resend email provider');
      cachedProvider = new ResendEmailProvider(config.resendApiKey);
      break;
    case 'console':
    default:
      log.info({}, 'auth-server:email:getProvider - Initializing Console email provider');
      cachedProvider = new ConsoleEmailProvider();
      break;
  }

  return cachedProvider;
}

export function resetEmailProviderCache(): void {
  cachedProvider = null;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const config = getEmailConfig() as EmailConfig;
  const provider = getProvider();

  const enrichedParams: SendEmailParams = {
    ...params,
    from: params.from || config.from,
    replyTo: params.replyTo || config.replyTo,
  };

  log.info(
    { to: params.to, subject: params.subject, provider: provider.name },
    'auth-server:email:sendEmail - Sending email',
  );

  return provider.send(enrichedParams);
}

export async function sendInviteEmail(params: {
  to: string;
  inviteUrl: string;
  organizationName: string;
  givenName?: string;
}): Promise<SendEmailResult> {
  log.info(
    { to: params.to, organizationName: params.organizationName },
    'auth-server:email:sendInviteEmail - Sending invite email',
  );

  const html = renderEmailHtml(
    React.createElement(InviteEmail, {
      inviteUrl: params.inviteUrl,
      organizationName: params.organizationName,
      givenName: params.givenName,
    }),
  );

  const text = inviteEmailText({
    inviteUrl: params.inviteUrl,
    organizationName: params.organizationName,
    givenName: params.givenName,
  });

  return sendEmail({
    to: params.to,
    subject: `You're invited to join ${params.organizationName} on EnsureOS`,
    html,
    text,
    tags: [{ name: 'category', value: 'invite' }],
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
}): Promise<SendEmailResult> {
  log.info(
    { to: params.to },
    'auth-server:email:sendPasswordResetEmail - Sending password reset email',
  );

  const html = renderEmailHtml(
    React.createElement(PasswordResetEmail, {
      resetUrl: params.resetUrl,
    }),
  );

  const text = passwordResetEmailText({ resetUrl: params.resetUrl });

  return sendEmail({
    to: params.to,
    subject: 'Reset your EnsureOS password',
    html,
    text,
    tags: [{ name: 'category', value: 'password-reset' }],
  });
}
