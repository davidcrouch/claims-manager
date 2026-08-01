import React from 'react';
import { AuthLayout } from './AuthLayout.js';
import { AuthLeftPanel } from './AuthLeftPanel.js';

interface LinkAccountPageProps {
  email: string;
  provider: string;
  existingProvider?: string;
  linkUrl?: string;
  cancelUrl?: string;
  nonce?: string;
}

export function LinkAccountPage({
  email,
  provider,
  existingProvider,
  linkUrl,
  cancelUrl,
  nonce,
}: LinkAccountPageProps) {
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
  const existingLabel = existingProvider
    ? existingProvider.charAt(0).toUpperCase() + existingProvider.slice(1)
    : 'another provider';

  return (
    <AuthLayout nonce={nonce}>
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-2xl md:flex-row md:items-stretch">
          <AuthLeftPanel variant="full" />

          <div className="flex min-w-0 flex-1 basis-0 flex-col justify-center px-8 py-10 sm:px-10">
            <div className="mb-8 text-center md:text-left">
              <div className="mb-3 flex items-center justify-center gap-3 md:justify-start">
                <span className="h-px w-8 shrink-0 bg-brand-500" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
                  Link Account
                </span>
                <span className="h-px w-8 shrink-0 bg-brand-500" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Account found
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                An account with this email already exists.
              </p>
            </div>

            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="mb-2">
                The email <span className="font-semibold">{email}</span> is already
                associated with an account signed in via{' '}
                <span className="font-semibold">{existingLabel}</span>.
              </p>
              <p>
                You are attempting to sign in with{' '}
                <span className="font-semibold">{providerLabel}</span>. Would you
                like to link this identity to your existing account?
              </p>
            </div>

            <div className="space-y-4">
              {linkUrl && (
                <a
                  href={linkUrl}
                  className="group inline-flex w-full items-center justify-center rounded-lg bg-brand-700 px-5 py-3 text-sm font-medium text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-xl"
                >
                  Link accounts
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
              )}

              {cancelUrl && (
                <a
                  href={cancelUrl}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
                >
                  Cancel and go back
                </a>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-slate-400 md:text-left">
              Linking accounts allows you to sign in with either method in the
              future.
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
