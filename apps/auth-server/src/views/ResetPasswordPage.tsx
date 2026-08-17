import React from 'react';
import { AuthLayout } from './AuthLayout.js';
import { AuthLeftPanel } from './AuthLeftPanel.js';

interface ResetPasswordRequestProps {
  mode: 'request';
  error?: string | null;
  success?: boolean;
  loginUrl: string;
  /** When present, preserved so "Sign in" can resume the OIDC interaction. */
  interaction?: string;
  nonce?: string;
}

interface ResetPasswordConfirmProps {
  mode: 'confirm';
  token: string;
  error?: string | null;
  loginUrl: string;
  nonce?: string;
}

interface ResetPasswordDoneProps {
  mode: 'done';
  loginUrl: string;
  nonce?: string;
}

type ResetPasswordPageProps =
  | ResetPasswordRequestProps
  | ResetPasswordConfirmProps
  | ResetPasswordDoneProps;

export function ResetPasswordPage(props: ResetPasswordPageProps) {
  if (props.mode === 'done') {
    return <ResetPasswordDoneView loginUrl={props.loginUrl} nonce={props.nonce} />;
  }

  if (props.mode === 'confirm') {
    return (
      <ResetPasswordConfirmView
        token={props.token}
        error={props.error}
        loginUrl={props.loginUrl}
        nonce={props.nonce}
      />
    );
  }

  return (
    <ResetPasswordRequestView
      error={props.error}
      success={props.success}
      loginUrl={props.loginUrl}
      interaction={props.interaction}
      nonce={props.nonce}
    />
  );
}

function AuthCardShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-2xl md:flex-row md:items-stretch">
        <AuthLeftPanel variant="full" />

        <div className="flex min-w-0 flex-1 basis-0 flex-col justify-center px-8 py-10 sm:px-10">
          <div className="mb-8 text-center md:text-left">
            <div className="mb-3 flex items-center justify-center gap-3 md:justify-start">
              <span className="h-px w-8 shrink-0 bg-brand-500" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
                {eyebrow}
              </span>
              <span className="h-px w-8 shrink-0 bg-brand-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function ResetPasswordRequestView({
  error,
  success,
  loginUrl,
  interaction,
  nonce,
}: {
  error?: string | null;
  success?: boolean;
  loginUrl: string;
  interaction?: string;
  nonce?: string;
}) {
  const submitScript = `
    (function() {
      var form = document.getElementById('resetForm');
      var submitBtn = document.getElementById('submitBtn');
      if (form) {
        form.addEventListener('submit', function() {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
          }
        });
      }
    })();
  `;

  return (
    <AuthLayout inlineScript={submitScript} nonce={nonce}>
      <AuthCardShell
        eyebrow="Password"
        title="Reset your password"
        subtitle={
          success
            ? 'Check your inbox for the next step.'
            : 'Enter the email associated with your account and we will send a reset link.'
        }
      >
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            If an account with that email exists, we&apos;ve sent a password reset link. Please check
            your inbox.
          </div>
        )}

        {!success && (
          <form
            id="resetForm"
            method="POST"
            action="/api/auth/reset-password/request"
            className="w-full"
          >
            {interaction ? <input type="hidden" name="interaction" value={interaction} /> : null}
            <div>
              <label
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500"
                htmlFor="email"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input w-full"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="mt-7">
              <button
                id="submitBtn"
                type="submit"
                className="group inline-flex w-full items-center justify-center rounded-lg bg-brand-700 px-5 py-3 text-sm font-medium text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-xl"
              >
                Send reset link
                <svg
                  className="ml-2 size-4 transition-transform duration-300 group-hover:translate-x-1"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 text-center text-sm text-slate-500 md:text-left">
          Remember your password?{' '}
          <a
            href={loginUrl}
            className="font-medium text-brand-600 transition-colors duration-200 hover:text-brand-700 hover:underline"
          >
            Sign in
          </a>
        </div>
      </AuthCardShell>
    </AuthLayout>
  );
}

function ResetPasswordConfirmView({
  token,
  error,
  loginUrl,
  nonce,
}: {
  token: string;
  error?: string | null;
  loginUrl: string;
  nonce?: string;
}) {
  const confirmScript = `
    (function() {
      var form = document.getElementById('confirmForm');
      var submitBtn = document.getElementById('confirmBtn');
      if (form) {
        form.addEventListener('submit', function(e) {
          var password = document.getElementById('password');
          var confirmPassword = document.getElementById('confirmPassword');
          if (password && confirmPassword && password.value !== confirmPassword.value) {
            e.preventDefault();
            alert('Passwords do not match.');
            return;
          }
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Updating...';
          }
        });
      }
    })();
  `;

  return (
    <AuthLayout inlineScript={confirmScript} nonce={nonce}>
      <AuthCardShell
        eyebrow="Password"
        title="Set a new password"
        subtitle="Choose a strong password you have not used before."
      >
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          id="confirmForm"
          method="POST"
          action="/api/auth/reset-password/confirm"
          className="w-full"
        >
          <input type="hidden" name="token" value={token} />
          <div className="space-y-5">
            <div>
              <label
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500"
                htmlFor="password"
              >
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="form-input w-full"
                placeholder="Choose a strong password"
                required
                minLength={8}
              />
            </div>
            <div>
              <label
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500"
                htmlFor="confirmPassword"
              >
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                className="form-input w-full"
                placeholder="Re-enter your password"
                required
                minLength={8}
              />
            </div>
          </div>
          <div className="mt-7">
            <button
              id="confirmBtn"
              type="submit"
              className="group inline-flex w-full items-center justify-center rounded-lg bg-brand-700 px-5 py-3 text-sm font-medium text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-xl"
            >
              Update password
              <svg
                className="ml-2 size-4 transition-transform duration-300 group-hover:translate-x-1"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        </form>

        <div className="mt-8 text-center text-sm text-slate-500 md:text-left">
          <a
            href={loginUrl}
            className="font-medium text-brand-600 transition-colors duration-200 hover:text-brand-700 hover:underline"
          >
            Back to sign in
          </a>
        </div>
      </AuthCardShell>
    </AuthLayout>
  );
}

function ResetPasswordDoneView({ loginUrl, nonce }: { loginUrl: string; nonce?: string }) {
  const safeLoginUrl = JSON.stringify(loginUrl);
  const autoRedirectScript = `
    (function() {
      var countdown = 5;
      var el = document.getElementById('countdown');
      var loginUrl = ${safeLoginUrl};
      var interval = setInterval(function() {
        countdown--;
        if (el) el.textContent = countdown;
        if (countdown <= 0) {
          clearInterval(interval);
          window.location.href = loginUrl;
        }
      }, 1000);
    })();
  `;

  return (
    <AuthLayout inlineScript={autoRedirectScript} nonce={nonce}>
      <AuthCardShell
        eyebrow="Password"
        title="Password updated"
        subtitle="Your password has been changed. Sign in with your new password to continue."
      >
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Password updated successfully.
        </div>

        <a
          href={loginUrl}
          className="group inline-flex w-full items-center justify-center rounded-lg bg-brand-700 px-5 py-3 text-sm font-medium text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-xl"
        >
          Continue to sign in
          <svg
            className="ml-2 size-4 transition-transform duration-300 group-hover:translate-x-1"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </a>
        <p className="mt-4 text-center text-xs text-slate-400 md:text-left">
          Redirecting in <span id="countdown">5</span> seconds…
        </p>
      </AuthCardShell>
    </AuthLayout>
  );
}
