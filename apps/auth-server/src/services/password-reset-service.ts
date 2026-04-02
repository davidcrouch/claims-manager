import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { GlobalCacheManager } from '../lib/cache/global-cache-manager.js';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { getUserByEmail, addPasswordIdentityToUser } from './identity-registration-service.js';
import { getBaseUrl } from '../config/env-validation.js';

const baseLogger = createLogger('auth-server:password-reset', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'password-reset', 'PasswordReset', 'auth-server');

const RESET_TOKEN_PREFIX = 'auth:password-reset:';
const RESET_TOKEN_TTL_SECONDS = 3600;

interface ResetTokenData {
  email: string;
  createdAt: number;
}

async function getRedis() {
  return GlobalCacheManager.getInstance('auth-server');
}

export async function requestPasswordReset(params: { email: string }): Promise<{ success: boolean }> {
  const { email } = params;

  log.info({ email }, 'auth-server:password-reset:requestPasswordReset - Processing request');

  try {
    const existingUser = await getUserByEmail(email);
    if (!existingUser) {
      log.info({ email }, 'auth-server:password-reset:requestPasswordReset - No user found, returning success silently');
      return { success: true };
    }

    const token = randomBytes(32).toString('hex');
    const redis = await getRedis();
    const tokenData: ResetTokenData = { email, createdAt: Date.now() };

    await redis.set(`${RESET_TOKEN_PREFIX}${token}`, JSON.stringify(tokenData), { ex: RESET_TOKEN_TTL_SECONDS });

    const resetUrl = `${getBaseUrl()}/reset-password/confirm?token=${token}`;

    log.info({ email, resetUrl }, 'auth-server:password-reset:requestPasswordReset - Reset token created. Email sending not yet configured — log the URL for development.');

    await sendPasswordResetEmail({ email, resetUrl });

    return { success: true };
  } catch (error) {
    log.error({ email, error: error.message }, 'auth-server:password-reset:requestPasswordReset - Failed');
    throw error;
  }
}

export async function confirmPasswordReset(params: { token: string; password: string }): Promise<{ success: boolean; error?: string }> {
  const { token, password } = params;

  log.info({}, 'auth-server:password-reset:confirmPasswordReset - Processing confirmation');

  try {
    const redis = await getRedis();
    const raw = await redis.get<string>(`${RESET_TOKEN_PREFIX}${token}`);

    if (!raw) {
      log.warn({}, 'auth-server:password-reset:confirmPasswordReset - Invalid or expired token');
      return { success: false, error: 'Invalid or expired reset token. Please request a new one.' };
    }

    const tokenData: ResetTokenData = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const { email } = tokenData;

    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters.' };
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return { success: false, error: 'Account not found. The reset token may be stale.' };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await addPasswordIdentityToUser({
      userId: user.userId,
      email,
      password: hashedPassword,
    });

    await redis.del(`${RESET_TOKEN_PREFIX}${token}`);

    log.info({ email }, 'auth-server:password-reset:confirmPasswordReset - Password updated successfully');

    return { success: true };
  } catch (error) {
    log.error({ error: error.message }, 'auth-server:password-reset:confirmPasswordReset - Failed');
    return { success: false, error: 'Failed to reset password. Please try again.' };
  }
}

async function sendPasswordResetEmail(params: { email: string; resetUrl: string }): Promise<void> {
  const { email, resetUrl } = params;
  log.warn(
    { email, resetUrl },
    'auth-server:password-reset:sendPasswordResetEmail - EMAIL SERVICE NOT CONFIGURED. Reset URL logged for development. Integrate an email provider (e.g., Resend, SendGrid) to send real emails.'
  );
}
