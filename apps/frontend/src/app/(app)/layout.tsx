import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { AppLayoutClient } from '@/components/layout/AppLayoutClient';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.authenticated || !session.identity) {
    redirect('/api/auth/login');
  }

  const { identity } = session;
  const headerUser = {
    given_name: identity.given_name ?? identity.name?.split(' ')[0],
    family_name: identity.family_name ?? identity.name?.split(' ').slice(1).join(' '),
    email: identity.email,
    picture: identity.picture,
  };

  return <AppLayoutClient user={headerUser}>{children}</AppLayoutClient>;
}
