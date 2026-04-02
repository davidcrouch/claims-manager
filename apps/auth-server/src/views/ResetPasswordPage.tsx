import React from 'react';
import { AuthLayout } from './AuthLayout.js';

interface ResetPasswordRequestProps {
  mode: 'request';
  error?: string | null;
  success?: boolean;
  loginUrl: string;
}

interface ResetPasswordConfirmProps {
  mode: 'confirm';
  token: string;
  error?: string | null;
  loginUrl: string;
}

type ResetPasswordPageProps = ResetPasswordRequestProps | ResetPasswordConfirmProps;

export function ResetPasswordPage(props: ResetPasswordPageProps) {
  const { error, loginUrl } = props;

  if (props.mode === 'confirm') {
    return <ResetPasswordConfirmView token={props.token} error={error} loginUrl={loginUrl} />;
  }

  return <ResetPasswordRequestView error={error} success={props.success} loginUrl={loginUrl} />;
}

function ResetPasswordRequestView({ error, success, loginUrl }: { error?: string | null; success?: boolean; loginUrl: string }) {
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
    <AuthLayout inlineScript={submitScript}>
      <section className="relative z-20 flex items-start min-h-screen">
        <div className="ml-[30%] min-w8xl max-w8xl px-4 sm:px-6">
          <div className="py-12 md:py-20">
            <div className="pb-12 text-center">
              <h1 className="animate-[gradient_6s_linear_infinite] bg-[linear-gradient(to_right,var(--color-gray-200),var(--color-indigo-200),var(--color-gray-50),var(--color-indigo-300),var(--color-gray-200))] bg-[length:200%_auto] bg-clip-text font-nacelle text-3xl font-semibold text-transparent md:text-4xl">
                Reset your password
              </h1>
              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                  If an account with that email exists, we&apos;ve sent a password reset link. Please check your inbox.
                </div>
              )}
            </div>

            {!success && (
              <form id="resetForm" method="POST" action="/api/auth/reset-password/request" className="mx-auto max-w-[400px]">
                <div>
                  <label className="mb-1 block text-sm font-medium text-indigo-200/65" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="form-input w-full"
                    placeholder="Your email"
                    required
                  />
                </div>
                <div className="mt-6">
                  <button
                    id="submitBtn"
                    type="submit"
                    className="btn w-full bg-linear-to-t from-indigo-600 to-indigo-500 bg-[length:100%_100%] bg-[bottom] text-white shadow-[inset_0px_1px_0px_0px_--theme(--color-white/.16)] hover:bg-[length:100%_150%]"
                  >
                    Reset Password
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6 text-center text-sm text-indigo-200/65">
              Remember your password?{' '}
              <a href={loginUrl} className="font-medium text-indigo-500">
                Sign in
              </a>
            </div>
          </div>
        </div>
      </section>
    </AuthLayout>
  );
}

function ResetPasswordConfirmView({ token, error, loginUrl }: { token: string; error?: string | null; loginUrl: string }) {
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
    <AuthLayout inlineScript={confirmScript}>
      <section className="relative z-20 flex items-start min-h-screen">
        <div className="ml-[30%] min-w8xl max-w8xl px-4 sm:px-6">
          <div className="py-12 md:py-20">
            <div className="pb-12 text-center">
              <h1 className="animate-[gradient_6s_linear_infinite] bg-[linear-gradient(to_right,var(--color-gray-200),var(--color-indigo-200),var(--color-gray-50),var(--color-indigo-300),var(--color-gray-200))] bg-[length:200%_auto] bg-clip-text font-nacelle text-3xl font-semibold text-transparent md:text-4xl">
                Set new password
              </h1>
              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            <form id="confirmForm" method="POST" action="/api/auth/reset-password/confirm" className="mx-auto max-w-[400px]">
              <input type="hidden" name="token" value={token} />
              <div className="space-y-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-indigo-200/65" htmlFor="password">
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
                  <label className="mb-1 block text-sm font-medium text-indigo-200/65" htmlFor="confirmPassword">
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
              <div className="mt-6">
                <button
                  id="confirmBtn"
                  type="submit"
                  className="btn w-full bg-linear-to-t from-indigo-600 to-indigo-500 bg-[length:100%_100%] bg-[bottom] text-white shadow-[inset_0px_1px_0px_0px_--theme(--color-white/.16)] hover:bg-[length:100%_150%]"
                >
                  Update Password
                </button>
              </div>
            </form>

            <div className="mt-6 text-center text-sm text-indigo-200/65">
              <a href={loginUrl} className="font-medium text-indigo-500">
                Back to sign in
              </a>
            </div>
          </div>
        </div>
      </section>
    </AuthLayout>
  );
}
