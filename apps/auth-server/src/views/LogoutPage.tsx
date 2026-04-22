import React from 'react';

interface LogoutPageProps {
  form: string;
}

// Palette aligned with the marketing landing page
/** Matches marketing landing page `NAVY` (apps/frontend/.../page.tsx) */
const NAVY = '#152a52';
const BLUE = '#3e86d4';
const SOFT_WHITE = '#f5f7fa';

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
        <title>Logging out - Claims Manager</title>
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
        className="relative min-h-screen font-sans"
        style={{ backgroundColor: '#ffffff', color: NAVY }}
      >
        {/* Navy grid pattern overlay (matches landing page hero) */}
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, ${NAVY} 1px, transparent 1px),
              linear-gradient(to bottom, ${NAVY} 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
            opacity: 0.07,
            maskImage:
              'radial-gradient(ellipse 90% 80% at 50% 40%, black 35%, transparent 90%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 90% 80% at 50% 40%, black 35%, transparent 90%)',
          }}
        />

        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
          <div
            className="w-full max-w-[440px] overflow-hidden rounded-2xl border px-8 py-12 text-center sm:px-10 sm:py-14"
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
              <span
                className="text-base tracking-tight"
                style={{ color: SOFT_WHITE }}
              >
                <span className="font-bold">Claims</span>{' '}
                <span className="font-light">Manager</span>
              </span>
            </div>

            {/* Eyebrow */}
            <div className="mb-3 flex items-center justify-center gap-3">
              <span className="h-px w-8" style={{ backgroundColor: BLUE }} />
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: BLUE }}
              >
                Signing out
              </span>
              <span className="h-px w-8" style={{ backgroundColor: BLUE }} />
            </div>

            <h1
              className="text-2xl font-bold tracking-tight md:text-3xl"
              style={{ color: SOFT_WHITE }}
            >
              Logging you out
            </h1>
            <p
              className="mt-2 text-sm"
              style={{ color: 'rgba(245,247,250,0.65)' }}
            >
              Please wait while we end your session.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center">
              <div
                className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-2"
                style={{
                  borderColor: 'rgba(255,255,255,0.15)',
                  borderTopColor: BLUE,
                }}
              />
              <p
                className="text-sm font-medium"
                style={{ color: 'rgba(245,247,250,0.7)' }}
              >
                Ending your session
              </p>
            </div>

            <div dangerouslySetInnerHTML={{ __html: form }} />
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: logoutScript }} />
      </body>
    </html>
  );
}
