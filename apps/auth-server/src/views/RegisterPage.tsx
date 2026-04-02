import React from 'react';
import { AuthLayout } from './AuthLayout.js';

interface RegisterPageProps {
  uid: string;
  error?: string | null;
  email?: string;
  googleAuthUrl: string;
  registerActionUrl: string;
  loginUrl: string;
  /** URL to restart the full OIDC flow (e.g. the frontend app origin) when the session has expired. */
  startOverUrl?: string;
  termsUrl?: string;
  privacyUrl?: string;
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
    })();
  `;

  const isSessionExpired = error && /session expired/i.test(error);

  return (
    <AuthLayout inlineScript={nameScript}>
      <div className="relative flex h-screen min-h-0 items-center justify-center overflow-hidden px-12">
        <div className="m-12 flex w-full max-w-[960px] shrink-0 gap-8 md:m-1">
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <img
              src="/mz_logo_blue_gold_clear.png"
              alt="Morezero"
              className="h-[76rem] max-h-[70vh] w-auto max-w-full object-contain md:h-[90rem] md:max-h-[70vh]"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center py-12 md:py-16 pr-12">
            <div className="pb-12 text-center">
              <h1 className="animate-[gradient_6s_linear_infinite] bg-[linear-gradient(to_right,var(--color-gray-200),var(--color-indigo-200),var(--color-gray-50),var(--color-indigo-300),var(--color-gray-200))] bg-[length:200%_auto] bg-clip-text font-nacelle text-3xl font-semibold text-transparent md:text-4xl">
                Create your account
              </h1>
              {isSessionExpired && (
                <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
                  <p className="mb-2">{error}</p>
                  <a href={startOverUrl || loginUrl} className="font-medium text-indigo-400 hover:underline">
                    Start over
                  </a>
                </div>
              )}
            </div>

            <form id="registerForm" action={registerActionUrl} method="POST" className="mx-auto w-full max-w-[400px]">
              <input type="hidden" id="name" name="name" />
              <div className="space-y-5">
                {error && !isSessionExpired && (
                  <div className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-indigo-200/65" htmlFor="firstName">
                      First name
                    </label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      className="form-input w-full"
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-indigo-200/65" htmlFor="lastName">
                      Last name
                    </label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      className="form-input w-full"
                      placeholder="Last name"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-indigo-200/65" htmlFor="email">
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
                  <label className="mb-1 block text-sm font-medium text-indigo-200/65" htmlFor="company">
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
                  <label className="mb-1 block text-sm font-medium text-indigo-200/65" htmlFor="password">
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
                  <label className="mb-1 block text-sm font-medium text-indigo-200/65" htmlFor="confirmPassword">
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
                  <input id="acceptTerms" name="acceptTerms" type="checkbox" className="mt-1" required />
                  <label htmlFor="acceptTerms" className="text-sm text-indigo-200/65">
                    <span className="text-red-500">*</span>{' '}
                    I agree to the{' '}
                    <a href={termsUrl} className="text-indigo-500 hover:underline">Terms of Service</a>{' '}
                    and{' '}
                    <a href={privacyUrl} className="text-indigo-500 hover:underline">Privacy Policy</a>.
                  </label>
                </div>
              </div>
              <div className="mt-6 space-y-5">
                <button
                  id="submitBtn"
                  type="submit"
                  className="btn w-full bg-linear-to-t from-indigo-600 to-indigo-500 bg-[length:100%_100%] bg-[bottom] text-white shadow-[inset_0px_1px_0px_0px_--theme(--color-white/.16)] hover:bg-[length:100%_150%]"
                >
                  Register
                </button>
                <div className="flex items-center gap-3 text-center text-sm italic text-gray-600 before:h-px before:flex-1 before:bg-linear-to-r before:via-gray-400/25 after:h-px after:flex-1 after:bg-linear-to-r after:from-transparent after:via-gray-400/25">
                  or
                </div>
                <a
                  href={googleAuthUrl}
                  className="btn relative z-10 w-full border border-gray-600 bg-gray-800/80 text-gray-300 hover:bg-gray-700/80 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign up with Google
                </a>
              </div>
            </form>

            <div className="mt-6 text-center text-sm text-indigo-200/65">
              Already have an account?{' '}
              <a href={loginUrl} className="font-medium text-indigo-500">
                Sign in
              </a>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
