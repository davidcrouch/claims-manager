import React from 'react';

const LOGO_TEXT = '/ensure_logo_text_dark.png';
const LOGO_ICON = '/ensure_logo_text_dark.png';
/** Exact baked-in background of ensure_logo_text_dark.png (rgb(2, 18, 45)). */
const LOGO_NAVY = '#02122d';

interface AuthLeftPanelProps {
  variant?: 'full' | 'icon';
}

export function AuthLeftPanel({ variant = 'full' }: AuthLeftPanelProps) {
  const isFull = variant === 'full';

  return (
    <div
      className="relative flex min-h-[200px] w-full flex-1 basis-0 flex-col items-center justify-center overflow-hidden px-5 py-8 sm:px-6 md:min-h-0"
      style={{ backgroundColor: LOGO_NAVY }}
    >
      <div className="relative z-10 flex w-full max-w-[min(100%,320px)] flex-col items-center justify-center">
        {isFull ? (
          <img
            src={LOGO_TEXT}
            alt="EnsureOS"
            width={640}
            height={400}
            className="h-auto w-full object-contain"
            decoding="async"
          />
        ) : (
          <img
            src={LOGO_ICON}
            alt="EnsureOS"
            width={256}
            height={256}
            className="mx-auto h-auto w-[min(55%,200px)] object-contain"
            decoding="async"
          />
        )}
      </div>
    </div>
  );
}
