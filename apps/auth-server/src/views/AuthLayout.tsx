import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  inlineScript?: string;
}

/**
 * Shared auth-pages layout.
 *
 * Mirrors the marketing landing page: solid white background with a faint
 * navy grid pattern, radially masked so the texture fades at the edges.
 * The actual content (login/register form, etc.) is expected to provide
 * its own navy panel for contrast against this light backdrop.
 */
export function AuthLayout({ children, inlineScript }: AuthLayoutProps) {
  /** Matches marketing landing page hero grid (`NAVY` in apps/frontend) */
  const NAVY = '#152a52';

  return (
    <main
      className="relative flex grow flex-col min-h-screen"
      style={{ backgroundColor: '#ffffff' }}
    >
      {/* Base white canvas */}
      <div className="fixed inset-0 z-0" style={{ backgroundColor: '#ffffff' }} />

      {/* Navy grid pattern (48px tiles, radial mask fades to edges) */}
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

      <div className="relative z-10 flex grow flex-col">{children}</div>

      {inlineScript && (
        <script dangerouslySetInnerHTML={{ __html: inlineScript }} />
      )}
    </main>
  );
}
