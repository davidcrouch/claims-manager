import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  inlineScript?: string;
  nonce?: string;
}

export function AuthLayout({ children, inlineScript, nonce }: AuthLayoutProps) {
  return (
    <main
      className="relative flex grow flex-col min-h-screen"
      style={{ backgroundColor: '#ffffff' }}
    >
      <div className="fixed inset-0 z-0" style={{ backgroundColor: '#ffffff' }} />

      <div
        aria-hidden="true"
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--color-brand-900) 1px, transparent 1px),
            linear-gradient(to bottom, var(--color-brand-900) 1px, transparent 1px)
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
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: inlineScript }} />
      )}
    </main>
  );
}
