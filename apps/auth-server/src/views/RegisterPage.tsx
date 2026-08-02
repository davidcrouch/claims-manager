import React from 'react';
import { AuthLayout } from './AuthLayout.js';
import { AuthLeftPanel } from './AuthLeftPanel.js';

interface RegisterPageProps {
  uid: string;
  error?: string | null;
  email?: string;
  googleAuthUrl: string;
  registerActionUrl: string;
  loginUrl: string;
  startOverUrl?: string;
  termsUrl?: string;
  privacyUrl?: string;
  nonce?: string;
}

export function RegisterPage({
  uid,
  error,
  email,
  googleAuthUrl,
  registerActionUrl,
  loginUrl,
  startOverUrl,
  termsUrl = '/terms',
  privacyUrl = '/privacy',
  nonce,
}: RegisterPageProps) {
  const nameScript = `
    (function() {
      var firstName = document.getElementById('firstName');
      var lastName = document.getElementById('lastName');
      var nameField = document.getElementById('name');
      var form = document.getElementById('registerForm');
      var submitBtn = document.getElementById('submitBtn');

      function updateName() {
        if (!firstName || !lastName || !nameField) return;
        var first = (firstName.value || '').trim();
        var last = (lastName.value || '').trim();
        nameField.value = [first, last].filter(Boolean).join(' ');
      }

      if (firstName) firstName.addEventListener('input', updateName);
      if (lastName) lastName.addEventListener('input', updateName);
      updateName();

      if (form) {
        form.addEventListener('submit', function(e) {
          updateName();
          var password = document.getElementById('password');
          var confirmPassword = document.getElementById('confirmPassword');
          if (password && confirmPassword && password.value !== confirmPassword.value) {
            e.preventDefault();
            alert('Passwords do not match.');
            return;
          }
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating account...';
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

  const isSessionExpired = error && /session expired/i.test(error);

  return (
    <AuthLayout inlineScript={nameScript} nonce={nonce}>
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-2xl md:flex-row md:items-stretch">
          <AuthLeftPanel variant="full" />

          <div className="flex min-w-0 flex-1 basis-0 flex-col justify-center px-8 py-10 sm:px-10">
            <div className="mb-8 text-center md:text-left">
              <div className="mb-3 flex items-center justify-center gap-3 md:justify-start">
                <span className="h-px w-8 shrink-0 bg-brand-500" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
                  Get started
                </span>
                <span className="h-px w-8 shrink-0 bg-brand-500" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Create your account
              </h1>
            </div>

            {isSessionExpired && (
              <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="mb-2">{error}</p>
                <a
                  href={startOverUrl || loginUrl}
                  className="font-medium text-brand-600 hover:underline"
                >
                  Start over
                </a>
              </div>
            )}

            <form
              id="registerForm"
              action={registerActionUrl}
              method="POST"
              className="w-full"
            >
              <input type="hidden" id="name" name="name" />
              <div className="space-y-5">
                {error && !isSessionExpired && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500" htmlFor="firstName">
                      First name
                    </label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      className="form-input w-full"
                      placeholder="First name"
                      required
                      autoComplete="given-name"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500" htmlFor="lastName">
                      Last name
                    </label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      className="form-input w-full"
                      placeholder="Last name"
                      required
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="form-input w-full"
                    placeholder="you@example.com"
                    required
                    defaultValue={email || ''}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500" htmlFor="company">
                    Company (optional)
                  </label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    className="form-input w-full"
                    placeholder="Your company"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500" htmlFor="password">
                    Password
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
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500" htmlFor="confirmPassword">
                    Confirm password
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
                <div className="flex items-start gap-3">
                  <input
                    id="acceptTerms"
                    name="acceptTerms"
                    type="checkbox"
                    value="true"
                    className="mt-1 size-4 shrink-0 cursor-pointer rounded border border-slate-300 text-brand-600"
                    required
                  />
                  <label htmlFor="acceptTerms" className="cursor-pointer text-sm text-slate-600">
                    <span className="text-red-600">*</span> I agree to the{' '}
                    <a
                      href={termsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand-600 hover:underline"
                    >
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a
                      href={privacyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand-600 hover:underline"
                    >
                      Privacy Policy
                    </a>
                    .
                  </label>
                </div>
              </div>

              <div className="mt-7 space-y-5">
                <button
                  id="submitBtn"
                  type="submit"
                  className="group inline-flex w-full items-center justify-center rounded-lg bg-brand-700 px-5 py-3 text-sm font-medium text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-xl"
                >
                  Create account
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
                  Sign up with Google
                </a>
              </div>
            </form>

            <div className="mt-8 text-center text-sm text-slate-500 md:text-left">
              Already have an account?{' '}
              <a
                href={loginUrl}
                className="font-medium text-brand-600 transition-colors duration-200 hover:text-brand-700 hover:underline"
              >
                Sign in
              </a>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
