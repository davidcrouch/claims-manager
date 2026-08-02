'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  FileSpreadsheet,
  ShoppingCart,
  Receipt,
  ClipboardList,
  ClipboardCheck,
  FileQuestion,
  FileInput,
  ReceiptText,
  TrendingUp,
  TrendingDown,
  CheckSquare,
  Calendar,
  MessageSquare,
  CalendarCheck,
  Users,
  UserCog,
  FolderOpen,
  Unplug,
  Settings,
  ChevronRight,
  Package,
  BookOpen,
  ArrowLeft,
  Files,
  Building2,
  ListTree,
  Bot,
  Server,
  Cable,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { Collapsible } from '@base-ui/react/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { hasFeature } from '@/lib/features';
import { cn } from '@/lib/utils';

export interface AppSidebarUser {
  given_name?: string | null;
  family_name?: string | null;
  email?: string | null;
  picture?: string | null;
}

export interface AppSidebarProps {
  features?: string[];
  orgName?: string | null;
  onOpenChat?: () => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  tab?: string;
  feature?: string;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
  defaultOpen?: boolean;
}

interface DetailContext {
  type: 'job';
  id: string;
  basePath: string;
}

function parseDetailContext(pathname: string): DetailContext | null {
  const jobMatch = pathname.match(/^\/jobs\/([^/?]+)/);
  if (jobMatch) {
    return { type: 'job', id: jobMatch[1], basePath: `/jobs/${jobMatch[1]}` };
  }
  return null;
}

const DETAIL_HIDDEN_LABELS = new Set(['CUSTOMERS', 'VENDORS', 'OPERATIONS']);

function getJobDetailGroups(basePath: string): NavGroup[] {
  return [
    {
      label: 'Customers',
      defaultOpen: true,
      items: [
        { title: 'Estimates', href: `${basePath}?tab=quotes`, icon: FileSpreadsheet, tab: 'quotes' },
        { title: 'Work Orders', href: `${basePath}?tab=work-orders`, icon: ClipboardCheck, tab: 'work-orders' },
        { title: 'Invoices', href: `${basePath}?tab=invoices`, icon: Receipt, tab: 'invoices' },
      ],
    },
    {
      label: 'Vendors',
      defaultOpen: true,
      items: [
        { title: 'RFQs', href: `${basePath}?tab=rfqs`, icon: FileQuestion, tab: 'rfqs' },
        { title: 'Proposals', href: `${basePath}?tab=proposals`, icon: FileInput, tab: 'proposals' },
        { title: 'Purchase Orders', href: `${basePath}?tab=purchase-orders`, icon: ShoppingCart, tab: 'purchase-orders' },
        { title: 'Bills', href: `${basePath}?tab=bills`, icon: ReceiptText, tab: 'bills' },
      ],
    },
    {
      label: 'Operations',
      defaultOpen: true,
      items: [
        { title: 'Journals', href: `${basePath}?tab=journals`, icon: BookOpen, tab: 'journals' },
        { title: 'Tasks', href: `${basePath}?tab=tasks`, icon: CheckSquare, tab: 'tasks' },
        { title: 'Schedule', href: `${basePath}?tab=schedule`, icon: Calendar, tab: 'schedule' },
        { title: 'Messages', href: `${basePath}?tab=messages`, icon: MessageSquare, tab: 'messages' },
        { title: 'Appointments', href: `${basePath}?tab=appointments`, icon: CalendarCheck, tab: 'appointments' },
        { title: 'Contacts', href: `${basePath}?tab=parties`, icon: Users, tab: 'parties' },
        { title: 'Documents', href: `${basePath}?tab=attachments`, icon: FolderOpen, tab: 'attachments' },
      ],
    },
  ];
}

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'CUSTOMERS',
    defaultOpen: true,
    items: [
      { title: 'Claims', href: '/claims', icon: FileText },
      { title: 'Jobs', href: '/jobs', icon: Briefcase },
      { title: 'Estimates', href: '/quotes', icon: FileSpreadsheet },
      { title: 'Work Orders', href: '/work-orders', icon: ClipboardCheck },
      { title: 'Invoices', href: '/invoices', icon: Receipt },
    ],
  },
  {
    label: 'VENDORS',
    defaultOpen: true,
    items: [
      { title: 'RFQs', href: '/rfqs', icon: FileQuestion },
      { title: 'Proposals', href: '/proposals', icon: FileInput },
      { title: 'POs', href: '/purchase-orders', icon: ShoppingCart },
      { title: 'Bills', href: '/bills', icon: ReceiptText },
    ],
  },
  {
    label: 'OPERATIONS',
    defaultOpen: true,
    items: [
      { title: 'Journals', href: '/journals', icon: BookOpen },
      { title: 'Tasks', href: '/tasks', icon: CheckSquare },
      { title: 'Schedule', href: '/schedule', icon: Calendar },
      { title: 'Messages', href: '/messages', icon: MessageSquare },
      { title: 'Appointments', href: '/appointments', icon: CalendarCheck },
      { title: 'Contacts', href: '/contacts', icon: Users },
      { title: 'Documents', href: '/documents', icon: FolderOpen },
    ],
  },
  {
    label: 'FINANCE',
    items: [
      { title: 'Accounts Receivable', href: '/finance/ar', icon: TrendingUp },
      { title: 'Accounts Payable', href: '/finance/ap', icon: TrendingDown },
      { title: 'Reports', href: '/reports', icon: ClipboardList },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { title: 'Connections', href: '/connections', icon: Unplug },
      { title: 'MCP Connections', href: '/mcp-connections', icon: Cable, feature: 'ai.connections' },
      { title: 'MCP Servers', href: '/admin/mcp-servers', icon: Server, feature: 'ai.connections' },
      { title: 'Agents', href: '/admin/agents', icon: Bot, feature: 'ai.agents' },
      { title: 'Skills', href: '/admin/skills', icon: Sparkles, feature: 'ai.skills' },
      { title: 'AI Audit', href: '/admin/ai-audit', icon: BarChart3 },
      { title: 'Catalogue', href: '/admin/catalog', icon: Package },
      { title: 'Document Categories', href: '/admin/documents', icon: FolderOpen },
      { title: 'Document Templates', href: '/admin/document-templates', icon: Files },
      { title: 'Filesystem Templates', href: '/admin/filesystem-templates', icon: ListTree },
      { title: 'Org Claims', href: '/admin/claims', icon: Building2 },
      { title: 'Users', href: '/admin/users', icon: UserCog },
      { title: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
];

export function AppSidebar({ features, orgName, onOpenChat }: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const detailContext = parseDetailContext(pathname);

  const detailGroups = detailContext?.type === 'job'
    ? getJobDetailGroups(detailContext.basePath)
    : [];

  const dashboardGroup = navGroups[0];
  const middleGroups = detailContext
    ? detailGroups
    : navGroups.filter((g) => g.label !== null && DETAIL_HIDDEN_LABELS.has(g.label));
  const persistentGroups = navGroups.filter(
    (g) => g.label !== null && !DETAIL_HIDDEN_LABELS.has(g.label),
  );

  function isItemActive(item: NavItem): boolean {
    if (item.tab !== undefined) {
      const currentTab = searchParams.get('tab');
      return (
        detailContext !== null &&
        pathname === detailContext.basePath &&
        currentTab === item.tab
      );
    }
    if (pathname === item.href) return true;
    if (item.href === '/dashboard') return false;
    return pathname.startsWith(item.href + '/');
  }

  function renderMenuItems(group: NavGroup) {
    const visibleItems = group.items.filter(
      (item) => !item.feature || hasFeature(features, item.feature),
    );
    return (
      <SidebarMenu>
        {visibleItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              render={
                <Link
                  href={item.href}
                  scroll={item.tab !== undefined ? false : undefined}
                >
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </Link>
              }
              isActive={isItemActive(item)}
              tooltip={item.title}
            />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  }

  function renderCollapsibleGroup(group: NavGroup, indent = false) {
    return (
      <Collapsible.Root
        key={group.label}
        defaultOpen={group.defaultOpen ?? false}
      >
        <SidebarGroup className={indent ? 'py-1' : undefined}>
          <Collapsible.Trigger className="group/collapsible flex w-full">
            <SidebarGroupLabel
              className={
                indent
                  ? 'flex-1 pl-4 text-white/50 group-data-[collapsible=icon]:pl-0'
                  : 'flex-1 text-white/60'
              }
            >
              {group.label}
              <ChevronRight className="ml-auto size-3.5 transition-transform duration-200 group-data-panel-open/collapsible:rotate-90" />
            </SidebarGroupLabel>
          </Collapsible.Trigger>
          <Collapsible.Panel className="overflow-hidden transition-all duration-200 data-ending-style:h-0 data-starting-style:h-0">
            <SidebarGroupContent className={indent ? 'pl-5 group-data-[collapsible=icon]:pl-0' : undefined}>
              {renderMenuItems(group)}
            </SidebarGroupContent>
          </Collapsible.Panel>
        </SidebarGroup>
      </Collapsible.Root>
    );
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={orgName ? 'pb-2' : 'pb-5'}>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Link
            href="/dashboard"
            className="group/brand flex min-w-0 flex-1 items-start gap-3 text-sidebar-foreground transition-opacity duration-200 hover:opacity-90"
          >
            <span className="relative mt-0.5 flex size-11 shrink-0 overflow-hidden rounded-md shadow-md ring-1 ring-white/15 transition-transform duration-300 group-hover/brand:scale-105">
              <Image
                src="/ensure_logo_dark.png"
                alt=""
                width={44}
                height={44}
                className="size-full object-contain"
              />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
              <span className="truncate text-lg font-semibold tracking-tight">
                EnsureOS
              </span>
              <span className="truncate text-xs leading-tight text-sidebar-foreground/65">
                Claims workspace
              </span>
            </span>
          </Link>
          {hasFeature(features, 'ai.chat') && onOpenChat && (
            <button
              type="button"
              onClick={onOpenChat}
              title="Open chat"
              aria-label="Open chat"
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-900/30 transition',
                'hover:scale-105 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300',
                'group-data-[collapsible=icon]:size-8',
              )}
            >
              <MessageSquare className="size-4" />
            </button>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {orgName ? (
          <div className="shrink-0 px-4 pb-3 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-xs font-medium text-sidebar-foreground">
              {orgName}
            </span>
          </div>
        ) : null}
        {/* Dashboard — always visible */}
        <SidebarGroup key="top">
          <SidebarGroupContent>
            {renderMenuItems(dashboardGroup)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Detail mode: back link, heading, then sub-groups */}
        {detailContext && (
          <>
            <SidebarGroup className="pb-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      size="sm"
                      render={
                        <Link href="/jobs">
                          <ArrowLeft className="size-4" />
                          <span>Back to Jobs</span>
                        </Link>
                      }
                      tooltip="Back to Jobs"
                    />
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
              <SidebarGroupLabel className="font-semibold tracking-wider text-white/60">
                JOB DETAIL
              </SidebarGroupLabel>
              <SidebarGroupContent className="pl-3 group-data-[collapsible=icon]:pl-0">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={
                        <Link href={detailContext.basePath} scroll={false}>
                          <LayoutDashboard className="size-4" />
                          <span>Overview</span>
                        </Link>
                      }
                      isActive={
                        pathname === detailContext.basePath &&
                        !searchParams.get('tab')
                      }
                      tooltip="Overview"
                    />
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Middle groups: detail sub-groups or top-level groups */}
        {middleGroups.map((group) =>
          renderCollapsibleGroup(group, !!detailContext),
        )}

        {/* Finance, Admin — always visible */}
        {persistentGroups.map((group) => renderCollapsibleGroup(group))}
      </SidebarContent>
    </Sidebar>
  );
}
