import React from 'react';
import { AuthLayout } from './AuthLayout.js';
import { AuthLeftPanel } from './AuthLeftPanel.js';

interface AcceptInvitePageProps {
  token: string;
  email: string;
  givenName?: string;
  familyName?: string;
  organizationName?: string;
  error?: string | null;
  googleAuthUrl?: string;
  microsoftAuthUrl?: string;
  nonce?: string;
}

export function AcceptInvitePage({
  token,
  email,
  givenName = '',
  familyName = '',
  organizationName,
  error,
  googleAuthUrl,
  microsoftAuthUrl,
  nonce,
}: AcceptInvitePageProps) {
  const submitScript = `
    (function() {
      var form = document.getElementById('acceptForm');
      var submitBtn = document.getElementById('submitBtn');
      if (form) {
        form.addEventListener('submit', function(e) {
          var password = document.getElementById('password');
          var confirmPassword = document.getElementById('confirmPassword');
          if (password && confirmPassword && password.value !== confirmPassword.value) {
            e.preventDefault();
            alert('Passwords do not match.');
            return;
          }
          if (password && password.value.length < 12) {
            e.preventDefault();
            alert('Password must be at least 12 characters.');
            return;
          }
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating your account...';
          }
        });
      }
    })();
  `;

  const orgLabel = organizationName || 'your organisation';
  const hasSocial = Boolean(googleAuthUrl || microsoftAuthUrl);

  return (
    <AuthLayout inlineScript={submitScript} nonce={nonce}>
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-2xl md:flex-row md:items-stretch">
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
              <p className="mt-2 text-sm text-slate-500">
                You&apos;ve been invited to join <span className="font-medium text-slate-700">{orgLabel}</span>.
                Enter your details and choose a password to finish joining.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form
              id="acceptForm"
              action="/api/auth/accept-invite"
              method="POST"
              className="w-full"
            >
              <input type="hidden" name="token" value={token} />

              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500"
                      htmlFor="firstName"
                    >
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
                      defaultValue={givenName}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500"
                      htmlFor="lastName"
                    >
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
                      defaultValue={familyName}
                    />
                  </div>
                </div>
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
                    className="form-input w-full bg-slate-50 text-slate-600"
                    value={email}
                    readOnly
                  />
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    className="form-input w-full"
                    placeholder="Choose a strong password (min 12 chars)"
                    required
                    minLength={12}
                    autoComplete="new-password"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Minimum 12 characters
                  </p>
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500"
                    htmlFor="confirmPassword"
                  >
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    className="form-input w-full"
                    placeholder="Re-enter your password"
                    required
                    minLength={12}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="mt-7 space-y-5">
                <button
                  id="submitBtn"
                  type="submit"
                  className="group inline-flex w-full items-center justify-center rounded-lg bg-brand-700 px-5 py-3 text-sm font-medium text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-xl"
                >
                  Create account &amp; join
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

                {hasSocial && (
                  <>
                    <div className="flex items-center gap-3 text-center text-xs uppercase tracking-widest text-slate-400">
                      <span className="h-px flex-1 bg-slate-200" />
                      <span>or</span>
                      <span className="h-px flex-1 bg-slate-200" />
                    </div>

                    {googleAuthUrl && (
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
                        Continue with Google
                      </a>
                    )}

                    {microsoftAuthUrl && (
                      <a
                        href={microsoftAuthUrl}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 23 23" aria-hidden="true">
                          <path fill="#f35325" d="M1 1h10v10H1z" />
                          <path fill="#81bc06" d="M12 1h10v10H12z" />
                          <path fill="#05a6f0" d="M1 12h10v10H1z" />
                          <path fill="#ffba08" d="M12 12h10v10H12z" />
                        </svg>
                        Continue with Microsoft
                      </a>
                    )}
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
