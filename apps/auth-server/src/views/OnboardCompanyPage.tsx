import React from 'react';
import { AuthLayout } from './AuthLayout.js';

interface OnboardCompanyPageProps {
  uid: string;
  email: string;
  name: string;
  provider?: string;
  providerUserId?: string;
  displayName?: string;
  avatarUrl?: string;
  error?: string | null;
  actionUrl: string;
  loginUrl: string;
}

export function OnboardCompanyPage({
  uid,
  email,
  name,
  provider,
  providerUserId,
  displayName,
  avatarUrl,
  error,
  actionUrl,
  loginUrl,
}: OnboardCompanyPageProps) {
  const submitScript = `
    (function() {
      var form = document.getElementById('onboardForm');
      var submitBtn = document.getElementById('submitBtn');
      if (form) {
        form.addEventListener('submit', function() {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Account...';
          }
        });
      }
    })();
  `;

  return (
    <AuthLayout inlineScript={submitScript}>
      <section className="relative z-20 flex items-start min-h-screen">
        <div className="ml-[30%] min-w8xl max-w8xl px-4 sm:px-6">
          <div className="py-12 md:py-20">
            <div className="pb-12 text-center">
              <h1 className="animate-[gradient_6s_linear_infinite] bg-[linear-gradient(to_right,var(--color-gray-200),var(--color-indigo-200),var(--color-gray-50),var(--color-indigo-300),var(--color-gray-200))] bg-[length:200%_auto] bg-clip-text font-nacelle text-3xl font-semibold text-transparent md:text-4xl">
                Complete Your Registration
              </h1>
              <p className="mt-4 text-sm text-indigo-200/65">
                We just need a bit more information to set up your account
              </p>
            </div>

            <form id="onboardForm" action={actionUrl} method="POST" className="mx-auto max-w-[400px]">
              <input type="hidden" name="interaction" value={uid} />
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="name" value={name} />
              {provider && <input type="hidden" name="provider" value={provider} />}
              {providerUserId && <input type="hidden" name="providerUserId" value={providerUserId} />}
              {displayName && <input type="hidden" name="displayName" value={displayName} />}
              {avatarUrl && <input type="hidden" name="avatarUrl" value={avatarUrl} />}

              <div className="space-y-5">
                {error && (
                  <div className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</div>
                )}

                <div className="bg-indigo-900/20 p-4 rounded-lg border border-indigo-800/30">
                  <div className="text-sm text-indigo-200/65 mb-2">Account Information</div>
                  <div className="text-sm text-indigo-100">{name}</div>
                  <div className="text-xs text-indigo-200/50">{email}</div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-indigo-200/65" htmlFor="organizationName">
                    Company Name (optional)
                  </label>
                  <input
                    id="organizationName"
                    name="organizationName"
                    type="text"
                    className="form-input w-full"
                    placeholder="Your company name"
                  />
                  <p className="mt-1 text-xs text-indigo-200/50">
                    If you don&apos;t provide a company name, we&apos;ll create one for you based on your name.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-indigo-200/65" htmlFor="organizationId">
                    Existing Organization ID (optional)
                  </label>
                  <input
                    id="organizationId"
                    name="organizationId"
                    type="text"
                    className="form-input w-full"
                    placeholder="If joining an existing organization"
                  />
                  <p className="mt-1 text-xs text-indigo-200/50">
                    If you&apos;re joining an existing organization, enter the organization ID here.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <button
                  id="submitBtn"
                  type="submit"
                  className="btn w-full bg-linear-to-t from-indigo-600 to-indigo-500 bg-[length:100%_100%] bg-[bottom] text-white shadow-[inset_0px_1px_0px_0px_--theme(--color-white/.16)] hover:bg-[length:100%_150%]"
                >
                  Complete Registration
                </button>
                <div className="text-center text-sm text-indigo-200/65">
                  Already have an account?{' '}
                  <a href={loginUrl} className="font-medium text-indigo-500">
                    Sign in
                  </a>
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>
    </AuthLayout>
  );
}
