import React from 'react';
import { AuthLayout } from './AuthLayout.js';
import { AuthLeftPanel } from './AuthLeftPanel.js';

interface AcceptInvitePageProps {
  token: string;
  email: string;
  error?: string | null;
}

export function AcceptInvitePage({ token, email, error }: AcceptInvitePageProps) {
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
            submitBtn.textContent = 'Setting up your account...';
          }
        });
      }
    })();
  `;

  return (
    <AuthLayout inlineScript={submitScript}>
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-2xl md:flex-row md:items-stretch">
          <AuthLeftPanel variant="full" />

          <div className="flex min-w-0 flex-1 basis-0 flex-col justify-center px-8 py-10 sm:px-10">
            <div className="mb-8 text-center md:text-left">
              <div className="mb-3 flex items-center justify-center gap-3 md:justify-start">
                <span className="h-px w-8 shrink-0 bg-brand-500" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
                  Welcome
                </span>
                <span className="h-px w-8 shrink-0 bg-brand-500" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Accept your invitation
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Set a password to complete your account setup.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form
              id="acceptForm"
              action="/accept-invite"
              method="POST"
              className="w-full"
            >
              <input type="hidden" name="token" value={token} />

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
                  />
                </div>
              </div>

              <div className="mt-7">
                <button
                  id="submitBtn"
                  type="submit"
                  className="group inline-flex w-full items-center justify-center rounded-lg bg-brand-700 px-5 py-3 text-sm font-medium text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-xl"
                >
                  Set password &amp; join
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
              Already have an account?{' '}
              <a
                href="/login"
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
