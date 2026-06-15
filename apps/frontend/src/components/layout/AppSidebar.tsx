'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  const initials = getInitials(user);
  const displayName = getDisplayName(user);

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
        {navGroups.map((group) => {
          const menuItems = (
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive = (() => {
                  if (pathname === item.href) return true;
                  if (item.href === '/dashboard') return false;
                  return pathname.startsWith(item.href + '/');
                })();
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={
                        <Link href={item.href}>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      }
                      isActive={isActive}
                      tooltip={item.title}
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          );

          if (!group.label) {
            return (
              <SidebarGroup key="top">
                <SidebarGroupContent>{menuItems}</SidebarGroupContent>
              </SidebarGroup>
            );
          }

          return (
            <Collapsible.Root
              key={group.label}
              defaultOpen={group.defaultOpen ?? false}
            >
              <SidebarGroup>
                <Collapsible.Trigger className="group/collapsible flex w-full">
                  <SidebarGroupLabel className="flex-1">
                    {group.label}
                    <ChevronRight className="ml-auto size-3.5 transition-transform duration-200 group-data-panel-open/collapsible:rotate-90" />
                  </SidebarGroupLabel>
                </Collapsible.Trigger>
                <Collapsible.Panel className="overflow-hidden transition-all duration-200 data-ending-style:h-0 data-starting-style:h-0">
                  <SidebarGroupContent>{menuItems}</SidebarGroupContent>
                </Collapsible.Panel>
              </SidebarGroup>
            </Collapsible.Root>
          );
        })}
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
