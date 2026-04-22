'use client';

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
  Shield,
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

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/dashboard"
          className="group/brand flex items-center gap-2.5 px-2 py-1.5 text-sidebar-foreground transition-opacity duration-200 hover:opacity-90"
        >
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-md shadow-md transition-transform duration-300 group-hover/brand:scale-105"
            style={{ backgroundColor: '#3e86d4' }}
          >
            <Shield className="size-4 text-white" strokeWidth={2.5} />
          </span>
          <span className="truncate text-sm tracking-tight group-data-[collapsible=icon]:hidden">
            <span className="font-bold">Claims</span>{' '}
            <span className="font-light">Manager</span>
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
      <SidebarFooter />
    </Sidebar>
  );
}
