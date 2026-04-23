import React from 'react';
import { AuthLeftPanel } from './AuthLeftPanel.js';

interface LogoutPageProps {
  form: string;
}

const NAVY = '#152a52';
const BLUE = '#3e86d4';
const LIGHT_GREY = '#d6dde4';
const INPUT_TEXT = '#0f172a';
const MUTED = '#64748b';

export function LogoutPage({ form }: LogoutPageProps) {
  const logoutScript = `
    setTimeout(function() {
      var form = document.getElementById('op.logoutForm');
      if (form) {
        var logoutInput = document.createElement('input');
        logoutInput.type = 'hidden';
        logoutInput.name = 'logout';
        logoutInput.value = 'yes';
        form.appendChild(logoutInput);
        form.submit();
      }
    }, 1500);
  `;

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Logging out — EnsureOS</title>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="relative min-h-screen bg-white font-sans"
        style={{ color: INPUT_TEXT }}
      >
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, ${NAVY} 1px, transparent 1px),
              linear-gradient(to bottom, ${NAVY} 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
            opacity: 0.18,
            maskImage:
              'radial-gradient(ellipse 100% 90% at 50% 40%, black 55%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 100% 90% at 50% 40%, black 55%, transparent 100%)',
          }}
        />

        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
          <div
            className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl md:flex-row md:items-stretch"
            style={{ borderColor: LIGHT_GREY }}
          >
            <AuthLeftPanel variant="icon" />

            <div className="flex min-w-0 flex-1 basis-0 flex-col justify-center px-8 py-12 text-center sm:px-10 sm:py-14">
              <div className="mb-8 flex items-center justify-center gap-2.5">
                <img
                  src="/ensure_logo.png"
                  alt=""
                  width={36}
                  height={36}
                  className="size-9 object-contain"
                  decoding="async"
                />
                <span className="text-base font-semibold tracking-tight" style={{ color: INPUT_TEXT }}>
                  EnsureOS
                </span>
              </div>

              <div className="mb-3 flex items-center justify-center gap-3">
                <span className="h-px w-8 shrink-0" style={{ backgroundColor: BLUE }} />
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: BLUE }}
                >
                  Signing out
                </span>
                <span className="h-px w-8 shrink-0" style={{ backgroundColor: BLUE }} />
              </div>

              <h1
                className="text-2xl font-bold tracking-tight md:text-3xl"
                style={{ color: INPUT_TEXT }}
              >
                Logging you out
              </h1>
              <p className="mt-2 text-sm" style={{ color: MUTED }}>
                Please wait while we end your session.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center">
                <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#3e86d4]" />
                <p className="text-sm font-medium" style={{ color: MUTED }}>
                  Ending your session
                </p>
              </div>

              <div dangerouslySetInnerHTML={{ __html: form }} />
            </div>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: logoutScript }} />
      </body>
    </html>
  );
}
