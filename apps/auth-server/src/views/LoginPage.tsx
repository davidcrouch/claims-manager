import React from 'react';
import { AuthLayout } from './AuthLayout.js';
import { AuthLeftPanel } from './AuthLeftPanel.js';

interface LoginPageProps {
  uid: string;
  error?: string | null;
  registered?: boolean;
  googleAuthUrl: string;
  microsoftAuthUrl?: string;
  loginActionUrl: string;
  registerUrl: string;
  resetPasswordUrl: string;
  appSlug?: string | null;
  startOverUrl?: string;
  nonce?: string;
  /** When false, hide public Sign Up (orgs already exist / invite-only). */
  showSignUp?: boolean;
}

export function LoginPage({
  uid,
  error,
  registered,
  googleAuthUrl,
  microsoftAuthUrl,
  loginActionUrl,
  registerUrl,
  resetPasswordUrl,
  appSlug,
  startOverUrl,
  nonce,
  showSignUp = false,
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

      var uid = ${JSON.stringify(uid)};
      var startOver = ${JSON.stringify(startOverUrl || '')};
      if (!uid || uid === 'expired') return;

      var KEEPALIVE_MS = 10 * 60 * 1000;
      var timer = null;

      function ping() {
        fetch('/login/session-refresh?interaction=' + encodeURIComponent(uid))
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (!data.success) { onExpired(); }
          })
          .catch(function() {});
      }

      function onExpired() {
        stop();
        if (startOver) { window.location.href = startOver; }
        else { window.location.reload(); }
      }

      function start() {
        if (timer) return;
        timer = setInterval(ping, KEEPALIVE_MS);
      }
      function stop() {
        if (timer) { clearInterval(timer); timer = null; }
      }

      if (document.visibilityState === 'visible') start();
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') { ping(); start(); }
        else { stop(); }
      });
    })();
  `;

  return (
    <AuthLayout inlineScript={sessionScript} nonce={nonce}>
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-2xl md:flex-row md:items-stretch">
          <AuthLeftPanel variant="full" />

          <div className="flex min-w-0 flex-1 basis-0 flex-col justify-center px-8 py-10 sm:px-10">
            <div className="mb-8 text-center md:text-left">
              <div className="mb-3 flex items-center justify-center gap-3 md:justify-start">
                <span className="h-px w-8 shrink-0 bg-brand-500" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
                  Sign in
                </span>
                <span className="h-px w-8 shrink-0 bg-brand-500" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Welcome back
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Sign in to continue to your claims workspace.
              </p>
            </div>

            {registered && (
              <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                Registration successful! Please sign in with your credentials.
              </div>
            )}
            {error && isSessionExpired && (
              <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="mb-2">{error}</p>
                <a
                  href={startOverUrl || '/'}
                  className="inline-flex items-center justify-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
                >
                  Start over
                </a>
              </div>
            )}
            {error && !isSessionExpired && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form
              id="loginForm"
              action={loginActionUrl}
              method={uid === 'expired' || isSessionExpired ? 'GET' : 'POST'}
              className="w-full"
              style={uid === 'expired' || isSessionExpired ? { display: 'none' } : undefined}
            >
              {appSlug != null && appSlug !== '' && (
                <input type="hidden" name="app_slug" value={appSlug} />
              )}
              <div className="space-y-5">
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
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <label
                      className="block text-xs font-medium uppercase tracking-wider text-slate-500"
                      htmlFor="password"
                    >
                      Password
                    </label>
                    <a
                      className="text-xs text-brand-600 transition-colors duration-200 hover:text-brand-700 hover:underline"
                      href={resetPasswordUrl}
                    >
                      Forgot?
                    </a>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    className="form-input w-full"
                    placeholder="Your password"
                  />
                </div>
              </div>

              <div className="mt-7 space-y-5">
                <button
                  id="submitBtn"
                  type="submit"
                  className="group inline-flex w-full items-center justify-center rounded-lg bg-brand-700 px-5 py-3 text-sm font-medium text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-xl"
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
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign in with Google
                </a>

                {microsoftAuthUrl && (
                  <a
                    href={microsoftAuthUrl}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 21 21" aria-hidden="true">
                      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                    </svg>
                    Sign in with Microsoft
                  </a>
                )}
              </div>
            </form>

            {showSignUp && (
              <div className="mt-8 text-center text-sm text-slate-500 md:text-left">
                Don&apos;t have an account?{' '}
                <a
                  href={registerUrl}
                  className="font-medium text-brand-600 transition-colors duration-200 hover:text-brand-700 hover:underline"
                >
                  Sign Up
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
