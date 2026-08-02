export type OrgMemberDto = {
  id: string;
  email: string | null;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  roles: string[];
  status: string;
  joinedAt: string;
  lastLoginAt: string | null;
  isActive: boolean;
};

export type AvailableRoleDto = {
  key: string;
  name: string;
  description: string | null;
  scope: string;
  isSystem: boolean;
};

export type InviteUserInput = {
  email: string;
  givenName?: string;
  familyName?: string;
  roles: string[];
};

export type UpdateUserRolesInput = {
  roles: string[];
};

export type UpdateUserStatusInput = {
  status: 'Active' | 'Disabled';
};
