'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  FileSpreadsheet,
  ShoppingCart,
  Receipt,
  ClipboardList,
  Building2,
  Unplug,
  LogOut,
} from 'lucide-react';
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

const navItems = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Claims', href: '/claims', icon: FileText },
  { title: 'Jobs', href: '/jobs', icon: Briefcase },
  { title: 'Quotes', href: '/quotes', icon: FileSpreadsheet },
  { title: 'Purchase Orders', href: '/purchase-orders', icon: ShoppingCart },
  { title: 'Invoices', href: '/invoices', icon: Receipt },
  { title: 'Reports', href: '/reports', icon: ClipboardList },
  { title: 'Vendors', href: '/vendors', icon: Building2 },
  { title: 'Connections', href: '/connections', icon: Unplug },
] as const;

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
      <SidebarHeader>
        <Link
          href="/dashboard"
          className="group/brand flex items-center gap-2.5 px-2 py-1.5 text-sidebar-foreground transition-opacity duration-200 hover:opacity-90"
        >
          <span className="relative flex size-8 shrink-0 overflow-hidden rounded-md shadow-md ring-1 ring-white/15 transition-transform duration-300 group-hover/brand:scale-105">
            <Image
              src="/ensure_logo_dark.png"
              alt=""
              width={32}
              height={32}
              className="size-full object-contain"
            />
          </span>
          <span className="truncate text-lg font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            EnsureOS
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
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
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
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
