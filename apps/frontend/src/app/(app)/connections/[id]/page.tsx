import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { ConnectionDetailContent } from '@/components/connections/ConnectionDetailContent';

export default async function ConnectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <SetBreadcrumbs
        items={[
          { title: 'Connections', href: '/connections' },
          { title: 'Detail', href: `/connections/${id}` },
        ]}
      />
      <ConnectionDetailContent connectionId={id} />
    </>
  );
}
