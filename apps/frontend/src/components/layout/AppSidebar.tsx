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
  feature?: string;
  /** When a job is selected, append ?jobId= to this link. */
  jobFilterable?: boolean;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
  defaultOpen?: boolean;
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
      { title: 'Journals', href: '/journals', icon: BookOpen, jobFilterable: true },
      { title: 'Assessments', href: '/assessments', icon: ClipboardList, jobFilterable: true },
      { title: 'Estimates', href: '/quotes', icon: FileSpreadsheet, jobFilterable: true },
      { title: 'Work Orders', href: '/work-orders', icon: ClipboardCheck, jobFilterable: true },
      { title: 'Invoices', href: '/invoices', icon: Receipt, jobFilterable: true },
    ],
  },
  {
    label: 'VENDORS',
    defaultOpen: true,
    items: [
      { title: 'Request for Quotations', href: '/rfqs', icon: FileQuestion, jobFilterable: true },
      { title: 'Proposals', href: '/proposals', icon: FileInput, jobFilterable: true },
      { title: 'Purchase Orders', href: '/purchase-orders', icon: ShoppingCart, jobFilterable: true },
      { title: 'Bills', href: '/bills', icon: ReceiptText, jobFilterable: true },
    ],
  },
  {
    label: 'OPERATIONS',
    defaultOpen: true,
    items: [
      { title: 'Tasks', href: '/tasks', icon: CheckSquare, jobFilterable: true },
      { title: 'Schedule', href: '/schedule', icon: Calendar, jobFilterable: true },
      { title: 'Messages', href: '/messages', icon: MessageSquare, jobFilterable: true },
      { title: 'Appointments', href: '/appointments', icon: CalendarCheck, jobFilterable: true },
      { title: 'Contacts', href: '/contacts', icon: Users, jobFilterable: true },
      { title: 'Documents', href: '/documents', icon: FolderOpen, jobFilterable: true },
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

function resolveHref(item: NavItem, jobId: string | null): string {
  if (!jobId || !item.jobFilterable) return item.href;
  return `${item.href}${item.href.includes('?') ? '&' : '?'}jobId=${jobId}`;
}

export function AppSidebar({ features, orgName, onOpenChat }: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const jobMatch = pathname.match(/^\/jobs\/([^/?]+)/);
  const jobId = jobMatch?.[1] ?? searchParams.get('jobId');

  const dashboardGroup = navGroups[0];
  const middleGroups = navGroups.filter((g) => g.label !== null);

  function isItemActive(item: NavItem): boolean {
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
        {visibleItems.map((item) => {
          const href = resolveHref(item, jobId);
          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                render={
                  <Link href={href}>
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </Link>
                }
                isActive={isItemActive(item)}
                tooltip={item.title}
              />
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    );
  }

  function renderCollapsibleGroup(group: NavGroup) {
    return (
      <Collapsible.Root
        key={group.label}
        defaultOpen={group.defaultOpen ?? false}
      >
        <SidebarGroup>
          <Collapsible.Trigger className="group/collapsible flex w-full">
            <SidebarGroupLabel className="flex-1 text-white/60">
              {group.label}
              <ChevronRight className="ml-auto size-3.5 transition-transform duration-200 group-data-panel-open/collapsible:rotate-90" />
            </SidebarGroupLabel>
          </Collapsible.Trigger>
          <Collapsible.Panel className="overflow-hidden transition-all duration-200 data-ending-style:h-0 data-starting-style:h-0">
            <SidebarGroupContent className="pl-3 group-data-[collapsible=icon]:pl-0">
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
        <SidebarGroup key="top">
          <SidebarGroupContent>
            {renderMenuItems(dashboardGroup)}
          </SidebarGroupContent>
        </SidebarGroup>
        {middleGroups.map((group) => renderCollapsibleGroup(group))}
      </SidebarContent>
    </Sidebar>
  );
}
