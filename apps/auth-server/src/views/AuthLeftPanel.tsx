import React from 'react';

/** Dark product column (left side of the auth card) */
const PRODUCT_COLUMN_BG = '#0e1b33';

const LOGO_TEXT = '/ensure_logo_text.png';
const LOGO_ICON = '/ensure_logo.png';

interface AuthLeftPanelProps {
  /** Login/register: full logo with text. Logout: icon-only mark. */
  variant?: 'full' | 'icon';
}

/**
 * Left column inside the auth card (50% width with sibling). Dark blue;
 * full EnsureOS lockup for login/register, icon-only for logout.
 */
export function AuthLeftPanel({ variant = 'full' }: AuthLeftPanelProps) {
  const isFull = variant === 'full';

  return (
    <div
      className="relative flex min-h-[200px] w-full flex-1 basis-0 flex-col items-center justify-center overflow-hidden px-5 py-8 sm:px-6 md:min-h-0"
      style={{ backgroundColor: PRODUCT_COLUMN_BG }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(62,134,212,0.25), transparent 55%), radial-gradient(ellipse 70% 50% at 80% 80%, rgba(62,134,212,0.12), transparent 50%)',
        }}
      />

      <div className="relative z-10 flex w-full max-w-[min(100%,320px)] flex-col items-center justify-center">
        {isFull ? (
          <img
            src={LOGO_TEXT}
            alt="EnsureOS"
            width={640}
            height={400}
            className="h-auto w-full object-contain drop-shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
            decoding="async"
          />
        ) : (
          <img
            src={LOGO_ICON}
            alt="EnsureOS"
            width={256}
            height={256}
            className="mx-auto h-auto w-[min(55%,200px)] object-contain drop-shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
            decoding="async"
          />
        )}
      </div>
    </div>
  );
}
