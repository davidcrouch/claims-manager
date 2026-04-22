import React from 'react';
import { AuthLayout } from './AuthLayout.js';
import { AuthLeftPanel } from './AuthLeftPanel.js';

interface LoginPageProps {
  uid: string;
  error?: string | null;
  registered?: boolean;
  googleAuthUrl: string;
  loginActionUrl: string;
  registerUrl: string;
  resetPasswordUrl: string;
  appSlug?: string | null;
  startOverUrl?: string;
}

const BLUE = '#3e86d4';
const SOFT_WHITE = '#f5f7fa';
const LIGHT_GREY = '#d6dde4';
const INPUT_TEXT = '#0f172a';
const MUTED = '#64748b';

const inputStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderColor: LIGHT_GREY,
  color: INPUT_TEXT,
};

const inputClass =
  'w-full rounded-lg border px-4 py-2.5 text-sm shadow-sm outline-none transition-colors duration-200 placeholder:text-slate-400 focus:border-[#3e86d4] focus:ring-2 focus:ring-[rgba(62,134,212,0.2)]';

export function LoginPage({
  uid: _uid,
  error,
  registered,
  googleAuthUrl,
  loginActionUrl,
  registerUrl,
  resetPasswordUrl,
  appSlug,
  startOverUrl,
}: LoginPageProps) {
  const isSessionExpired =
    error && /session.*expired|session.*not found/i.test(error);

  const sessionScript = `
    (function() {
      var form = document.getElementById('loginForm');
      var submitBtn = document.getElementById('submitBtn');
      if (form) {
        form.addEventListener('submit', function() {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';
          }
        });
      }
    })();
  `;

  return (
    <AuthLayout inlineScript={sessionScript}>
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div
          className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl md:flex-row md:items-stretch"
          style={{ borderColor: LIGHT_GREY }}
        >
          <AuthLeftPanel variant="full" />

          <div className="flex min-w-0 flex-1 basis-0 flex-col justify-center px-8 py-10 sm:px-10">
            <div className="mb-8 text-center md:text-left">
              <div className="mb-3 flex items-center justify-center gap-3 md:justify-start">
                <span className="h-px w-8 shrink-0" style={{ backgroundColor: BLUE }} />
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: BLUE }}
                >
                  Sign in
                </span>
                <span className="h-px w-8 shrink-0" style={{ backgroundColor: BLUE }} />
              </div>
              <h1
                className="text-2xl font-bold tracking-tight md:text-3xl"
                style={{ color: INPUT_TEXT }}
              >
                Welcome back
              </h1>
              <p className="mt-2 text-sm" style={{ color: MUTED }}>
                Sign in to continue to your claims workspace.
              </p>
            </div>

            {registered && (
              <div
                className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
              >
                Registration successful! Please sign in with your credentials.
              </div>
            )}
            {error && isSessionExpired && (
              <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="mb-2">{error}</p>
                <a
                  href={startOverUrl || registerUrl}
                  className="font-medium hover:underline"
                  style={{ color: BLUE }}
                >
                  Start over
                </a>
              </div>
            )}
            {error && !isSessionExpired && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                {error}
              </div>
            )}

            <form
              id="loginForm"
              action={loginActionUrl}
              method="POST"
              className="w-full"
            >
              {appSlug != null && appSlug !== '' && (
                <input type="hidden" name="app_slug" value={appSlug} />
              )}
              <div className="space-y-5">
                <div>
                  <label
                    className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
                    htmlFor="email"
                    style={{ color: MUTED }}
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className={inputClass}
                    style={inputStyle}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <label
                      className="block text-xs font-medium uppercase tracking-wider"
                      htmlFor="password"
                      style={{ color: MUTED }}
                    >
                      Password
                    </label>
                    <a
                      className="text-xs transition-colors duration-200 hover:underline"
                      href={resetPasswordUrl}
                      style={{ color: BLUE }}
                    >
                      Forgot?
                    </a>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    className={inputClass}
                    style={inputStyle}
                    placeholder="Your password"
                  />
                </div>
              </div>

              <div className="mt-7 space-y-5">
                <button
                  id="submitBtn"
                  type="submit"
                  className="group inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-medium shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                  style={{ backgroundColor: BLUE, color: SOFT_WHITE }}
                >
                  Sign in
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

                <div className="flex items-center gap-3 text-center text-xs uppercase tracking-widest text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-slate-200" />
                </div>

                <a
                  href={googleAuthUrl}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </a>
              </div>
            </form>

            <div className="mt-8 text-center text-sm md:text-left" style={{ color: MUTED }}>
              Don&apos;t have an account?{' '}
              <a
                href={registerUrl}
                className="font-medium transition-colors duration-200 hover:underline"
                style={{ color: BLUE }}
              >
                Sign Up
              </a>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
