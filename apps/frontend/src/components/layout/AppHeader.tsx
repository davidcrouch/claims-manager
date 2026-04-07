'use client';

import { Bell, LogOut } from 'lucide-react';
import {
  SidebarTrigger,
  SidebarRail,
} from '@/components/ui/sidebar';
import { BreadcrumbConsumer } from './BreadcrumbProvider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export interface AppHeaderUser {
  given_name?: string | null;
  family_name?: string | null;
  email?: string | null;
  picture?: string | null;
}

export interface AppHeaderProps {
  user?: AppHeaderUser | null;
}

export function AppHeader({ user }: AppHeaderProps) {
  const initials = user?.given_name?.[0] && user?.family_name?.[0]
    ? `${user.given_name[0]}${user.family_name[0]}`
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4">
      <SidebarTrigger />
      <SidebarRail />
      <div className="flex flex-1 items-center justify-between gap-4">
        <BreadcrumbConsumer />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">
                  {user?.given_name} {user?.family_name}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
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
        </div>
      </div>
    </header>
  );
}
