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

// Palette aligned with the marketing landing page
/** Matches marketing landing page `NAVY` (apps/frontend/.../page.tsx) */
const NAVY = '#152a52';
const BLUE = '#3e86d4';
const SOFT_WHITE = '#f5f7fa';
const LIGHT_GREY = '#d6dde4';
const INPUT_TEXT = '#0f172a';

const inputStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderColor: LIGHT_GREY,
  color: INPUT_TEXT,
};

const inputClass =
  'w-full rounded-lg border px-4 py-2.5 text-sm shadow-sm outline-none transition-colors duration-200 placeholder:text-slate-400 focus:border-[#3e86d4] focus:ring-2 focus:ring-[rgba(62,134,212,0.25)]';

const labelClass =
  'mb-1.5 block text-xs font-medium uppercase tracking-wider';
const labelStyle: React.CSSProperties = { color: 'rgba(245,247,250,0.7)' };

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
      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div
          className="w-full max-w-[520px] overflow-hidden rounded-2xl border px-8 py-10 sm:px-10 sm:py-12"
          style={{
            backgroundColor: NAVY,
            borderColor: 'rgba(255,255,255,0.08)',
            boxShadow:
              '0 40px 80px -20px rgba(21,42,82,0.45), 0 0 0 1px rgba(21,42,82,0.08)',
            color: SOFT_WHITE,
          }}
        >
          {/* Brand */}
          <div className="mb-8 flex items-center justify-center gap-2.5">
            <div
              className="flex size-9 items-center justify-center rounded-md shadow-md"
              style={{ backgroundColor: BLUE }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="text-base tracking-tight" style={{ color: SOFT_WHITE }}>
              <span className="font-bold">Claims</span>{' '}
              <span className="font-light">Manager</span>
            </span>
          </div>

          {/* Eyebrow + heading */}
          <div className="mb-8 text-center">
            <div className="mb-3 flex items-center justify-center gap-3">
              <span className="h-px w-8" style={{ backgroundColor: BLUE }} />
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: BLUE }}
              >
                Get started
              </span>
              <span className="h-px w-8" style={{ backgroundColor: BLUE }} />
            </div>
            <h1
              className="text-2xl font-bold tracking-tight md:text-3xl"
              style={{ color: SOFT_WHITE }}
            >
              Create your account
            </h1>
            <p
              className="mt-2 text-sm"
              style={{ color: 'rgba(245,247,250,0.65)' }}
            >
              Start your 14-day free trial — no credit card required.
            </p>
          </div>

          {isSessionExpired && (
            <div
              className="mb-5 rounded-lg border p-4 text-sm"
              style={{
                backgroundColor: 'rgba(251,191,36,0.1)',
                borderColor: 'rgba(251,191,36,0.35)',
                color: '#fde68a',
              }}
            >
              <p className="mb-2">{error}</p>
              <a
                href={startOverUrl || loginUrl}
                className="font-medium hover:underline"
                style={{ color: BLUE }}
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
                <div
                  className="rounded-lg border p-3 text-sm"
                  style={{
                    backgroundColor: 'rgba(239,68,68,0.12)',
                    borderColor: 'rgba(239,68,68,0.35)',
                    color: '#fca5a5',
                  }}
                >
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} style={labelStyle} htmlFor="firstName">
                    First name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    className={inputClass}
                    style={inputStyle}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle} htmlFor="lastName">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    className={inputClass}
                    style={inputStyle}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass} style={labelStyle} htmlFor="email">
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
                  defaultValue={email || ''}
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle} htmlFor="company">
                  Company (optional)
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Your company"
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle} htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Choose a strong password"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label
                  className={labelClass}
                  style={labelStyle}
                  htmlFor="confirmPassword"
                >
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  className={inputClass}
                  style={inputStyle}
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
                  className="mt-1 size-4 rounded border bg-white accent-[#3e86d4]"
                  style={{ borderColor: LIGHT_GREY }}
                  required
                />
                <label
                  htmlFor="acceptTerms"
                  className="text-sm"
                  style={{ color: 'rgba(245,247,250,0.7)' }}
                >
                  <span style={{ color: '#fca5a5' }}>*</span> I agree to the{' '}
                  <a
                    href={termsUrl}
                    className="font-medium hover:underline"
                    style={{ color: BLUE }}
                  >
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a
                    href={privacyUrl}
                    className="font-medium hover:underline"
                    style={{ color: BLUE }}
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
                className="group inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-medium shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                style={{ backgroundColor: BLUE, color: SOFT_WHITE }}
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

              <div
                className="flex items-center gap-3 text-center text-xs uppercase tracking-widest"
                style={{ color: 'rgba(245,247,250,0.45)' }}
              >
                <span
                  className="h-px flex-1"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                />
                <span>or</span>
                <span
                  className="h-px flex-1"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                />
              </div>

              <a
                href={googleAuthUrl}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/5 hover:shadow-lg"
                style={{
                  borderColor: 'rgba(255,255,255,0.15)',
                  color: SOFT_WHITE,
                  backgroundColor: 'rgba(255,255,255,0.02)',
                }}
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
                Sign up with Google
              </a>
            </div>
          </form>

          <div
            className="mt-8 text-center text-sm"
            style={{ color: 'rgba(245,247,250,0.65)' }}
          >
            Already have an account?{' '}
            <a
              href={loginUrl}
              className="font-medium transition-colors duration-200 hover:underline"
              style={{ color: BLUE }}
            >
              Sign in
            </a>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
