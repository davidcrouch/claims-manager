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
  LogOut,
  ChevronRight,
  Package,
  BookOpen,
  ArrowLeft,
} from 'lucide-react';
import { Collapsible } from '@base-ui/react/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export interface AppSidebarUser {
  given_name?: string | null;
  family_name?: string | null;
  email?: string | null;
  picture?: string | null;
}

export interface AppSidebarProps {
  user?: AppSidebarUser | null;
}

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  tab?: string;
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
      { title: 'Documents', href: '/admin/documents', icon: FolderOpen },
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
      { title: 'Catalogue', href: '/admin/catalog', icon: Package },
      { title: 'Users', href: '/admin/users', icon: UserCog },
      { title: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
];

function getInitials(user?: AppSidebarUser | null): string {
  if (user?.given_name?.[0] && user?.family_name?.[0]) {
    return `${user.given_name[0]}${user.family_name[0]}`;
  }
  return user?.email?.[0]?.toUpperCase() ?? '?';
}

function getDisplayName(user?: AppSidebarUser | null): string {
  const parts = [user?.given_name, user?.family_name].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return user?.email ?? 'Account';
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initials = getInitials(user);
  const displayName = getDisplayName(user);

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
    return (
      <SidebarMenu>
        {group.items.map((item) => (
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
                  ? 'flex-1 pl-4 text-emerald-400/80 group-data-[collapsible=icon]:pl-0'
                  : 'flex-1'
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
      <SidebarHeader className="pb-5">
        <Link
          href="/dashboard"
          className="group/brand flex items-start gap-3 px-2 py-1.5 text-sidebar-foreground transition-opacity duration-200 hover:opacity-90"
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
      </SidebarHeader>
      <SidebarContent>
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
              <SidebarGroupLabel className="font-semibold tracking-wider text-sidebar-foreground/90">
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
      <SidebarFooter className="pb-6">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    tooltip={displayName}
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[10px]">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-col text-left leading-tight">
                      <span className="truncate text-xs font-medium">
                        {displayName}
                      </span>
                      {user?.email && (
                        <span className="truncate text-[10px] text-sidebar-foreground/60">
                          {user.email}
                        </span>
                      )}
                    </span>
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent side="top" align="start" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{displayName}</p>
                  {user?.email && (
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  )}
                </div>
                <DropdownMenuItem
                  render={
                    <a
                      href="/api/auth/logout"
                      className="flex w-full cursor-pointer items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </a>
                  }
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
