import React from 'react';
import { AuthLayout } from './AuthLayout.js';
import { AuthLeftPanel } from './AuthLeftPanel.js';

interface InviteInvalidPageProps {
  message?: string;
  loginUrl: string;
  nonce?: string;
}

export function InviteInvalidPage({
  message = 'This invitation link is invalid or has expired. Ask your administrator to send a new invite.',
  loginUrl,
  nonce,
}: InviteInvalidPageProps) {
  return (
    <AuthLayout nonce={nonce}>
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-2xl md:flex-row md:items-stretch">
          <AuthLeftPanel variant="full" />

          <div className="flex min-w-0 flex-1 basis-0 flex-col justify-center px-8 py-10 text-center sm:px-10 md:text-left">
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-center gap-3 md:justify-start">
                <span className="h-px w-8 shrink-0 bg-brand-500" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
                  Invitation
                </span>
                <span className="h-px w-8 shrink-0 bg-brand-500" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Invitation unavailable
              </h1>
              <p className="mt-2 text-sm text-slate-500">{message}</p>
            </div>

            <a
              href={loginUrl}
              className="group inline-flex w-full items-center justify-center rounded-lg bg-brand-700 px-5 py-3 text-sm font-medium text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-xl"
            >
              Go to sign in
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
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
