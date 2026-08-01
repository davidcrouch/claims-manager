import React from 'react';

interface WordmarkProps {
  tone?: 'light' | 'dark';
  className?: string;
}

export function Wordmark({ tone = 'light', className = '' }: WordmarkProps) {
  const text = tone === 'light' ? '#ffffff' : '#0b1d3d';
  const mark = tone === 'light' ? '#23b794' : '#0fa085';

  return (
    <svg
      viewBox="0 0 200 40"
      role="img"
      aria-label="EnsureOS"
      className={`h-10 w-auto ${className}`}
    >
      <rect x="0" y="6" width="28" height="28" rx="7" fill={mark} />
      <path
        d="M9 14h10M9 20h7M9 26h10"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <text
        x="38"
        y="27"
        fill={text}
        fontFamily="Inter, sans-serif"
        fontSize="21"
        fontWeight="600"
        letterSpacing="-0.4"
      >
        EnsureOS
      </text>
    </svg>
  );
}
