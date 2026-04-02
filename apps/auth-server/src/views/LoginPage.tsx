import React from 'react';
import { AuthLayout } from './AuthLayout.js';

interface LoginPageProps {
   uid: string;
   error?: string | null;
   registered?: boolean;
   googleAuthUrl: string;
   loginActionUrl: string;
   registerUrl: string;
   resetPasswordUrl: string;
   /** App slug from OIDC interaction; sent as x-more0-app-slug header on form submit */
   appSlug?: string | null;
   /** URL to restart the full OIDC flow (e.g. the frontend app origin) when the session has expired. */
   startOverUrl?: string;
}

export function LoginPage({
   uid,
   error,
   registered,
   googleAuthUrl,
   loginActionUrl,
   registerUrl,
   resetPasswordUrl,
   appSlug,
   startOverUrl,
}: LoginPageProps) {
   const isSessionExpired = error && /session.*expired|session.*not found/i.test(error);

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
    })();
  `;

   return (
      <AuthLayout inlineScript={sessionScript}>
         <div className="relative flex h-screen min-h-0 items-center justify-center overflow-hidden px-12">
            <div className="m-12 flex w-full max-w-[960px] shrink-0 gap-8 md:m-1">
               <div className="flex min-w-0 flex-1 items-center justify-cente">
                  <img
                     src="/mz_logo_blue_gold_clear.png"
                     alt="Morezero"
                     className="h-[76rem] max-h-[70vh] w-auto max-w-full object-contain md:h-[90rem] md:max-h-[70vh]"
                  />
               </div>
               <div className="flex min-w-0 flex-1 flex-col items-center justify-center py-12 md:py-16 pr-12">
                  <div className="pb-12 text-center">
                     <h1 className="animate-[gradient_6s_linear_infinite] bg-[linear-gradient(to_right,var(--color-gray-200),var(--color-indigo-200),var(--color-gray-50),var(--color-indigo-300),var(--color-gray-200))] bg-[length:200%_auto] bg-clip-text font-nacelle text-3xl font-semibold text-transparent md:text-4xl">
                        Welcome back
                     </h1>
                     {registered && (
                        <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                           Registration successful! Please sign in with your credentials.
                        </div>
                     )}
                     {error && isSessionExpired && (
                        <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
                           <p className="mb-2">{error}</p>
                           <a href={startOverUrl || registerUrl} className="font-medium text-indigo-400 hover:underline">
                              Start over
                           </a>
                        </div>
                     )}
                     {error && !isSessionExpired && (
                        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                           {error}
                        </div>
                     )}
                  </div>

                  <form id="loginForm" action={loginActionUrl} method="POST" className="mx-auto w-full max-w-[320px]">
                     {appSlug != null && appSlug !== '' && (
                        <input type="hidden" name="app_slug" value={appSlug} />
                     )}
                     <div className="space-y-5">
                        <div>
                           <label
                              className="mb-1 block text-sm font-medium text-indigo-200/65"
                              htmlFor="email"
                           >
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
                        <div>
                           <div className="mb-1 flex items-center justify-between gap-3">
                              <label
                                 className="block text-sm font-medium text-indigo-200/65"
                                 htmlFor="password"
                              >
                                 Password
                              </label>
                              <a
                                 className="text-sm text-gray-600 hover:underline"
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
                     <div className="mt-6 space-y-5">
                        <button
                           id="submitBtn"
                           type="submit"
                           className="btn w-full bg-linear-to-t from-indigo-600 to-indigo-500 bg-[length:100%_100%] bg-[bottom] text-white shadow-[inset_0px_1px_0px_0px_--theme(--color-white/.16)] hover:bg-[length:100%_150%]"
                        >
                           Sign in
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
                           Sign in with Google
                        </a>
                     </div>
                  </form>

                  <div className="mt-6 text-center text-sm text-indigo-200/65">
                     Don&apos;t have an account?{' '}
                     <a href={registerUrl} className="font-medium text-indigo-500">
                        Sign Up
                     </a>
                  </div>
               </div>
            </div>
         </div>
      </AuthLayout>
   );
}
