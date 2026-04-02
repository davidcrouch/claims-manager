import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  inlineScript?: string;
}

export function AuthLayout({ children, inlineScript }: AuthLayoutProps) {
  return (
    <main className="relative flex grow flex-col min-h-screen bg-gray-950">
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-gray-950 via-gray-900 to-indigo-950" />
      <div className="relative z-10">
        {children}
      </div>
      {inlineScript && (
        <script dangerouslySetInnerHTML={{ __html: inlineScript }} />
      )}
    </main>
  );
}
