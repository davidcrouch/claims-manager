import type { Metadata } from 'next';
import { Figtree } from 'next/font/google';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const figtree = Figtree({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: {
    default: 'EnsureOS',
    template: '%s | EnsureOS',
  },
  description: 'EnsureOS — claim, repair, and operations workspace for insurance teams.',
  icons: {
    icon: [{ url: '/ensure_logo.png', type: 'image/png' }],
    apple: [{ url: '/ensure_logo.png', type: 'image/png' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
