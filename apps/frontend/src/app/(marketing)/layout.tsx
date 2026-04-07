/**
 * Marketing layout - full width, no sidebar.
 * Used for landing page and other public routes.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen">{children}</div>;
}
