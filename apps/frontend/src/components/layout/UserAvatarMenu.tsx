'use client';

import { LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { AppSidebarUser } from './AppSidebar';

export interface UserAvatarMenuProps {
  user?: AppSidebarUser | null;
}

function getInitials(user?: AppSidebarUser | null): string {
  if (user?.given_name?.[0] && user?.family_name?.[0]) {
    return `${user.given_name[0]}${user.family_name[0]}`.toUpperCase();
  }
  return user?.email?.[0]?.toUpperCase() ?? '?';
}

function getDisplayName(user?: AppSidebarUser | null): string {
  const parts = [user?.given_name, user?.family_name].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return user?.email ?? 'Account';
}

export function UserAvatarMenu({ user }: UserAvatarMenuProps) {
  const initials = getInitials(user);
  const displayName = getDisplayName(user);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        aria-label={`Account menu for ${displayName}`}
      >
        <Avatar size="sm" className="size-8 cursor-pointer">
          {user?.picture ? (
            <AvatarImage src={user.picture} alt={displayName} />
          ) : null}
          <AvatarFallback className="bg-sidebar-accent text-xs font-medium text-sidebar-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="w-56">
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
  );
}
