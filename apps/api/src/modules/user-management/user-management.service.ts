import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UsersRepository } from '../../database/repositories/users.repository';
import { AuthServerClient } from '../auth-server/auth-server.client';
import { ContactsService } from '../contacts/contacts.service';
import type {
  AvailableRoleDto,
  InviteUserInput,
  OrgMemberDto,
  UpdateUserInput,
  UpdateUserStatusInput,
} from './user-management.types';

const LOG_PREFIX = 'api.UserManagementService';

function splitName(name: string | null): { givenName: string | null; familyName: string | null } {
  if (!name?.trim()) return { givenName: null, familyName: null };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { givenName: parts[0]!, familyName: null };
  return {
    givenName: parts[0]!,
    familyName: parts.slice(1).join(' '),
  };
}

@Injectable()
export class UserManagementService {
  private readonly log = new Logger('UserManagementService');

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly authServerClient: AuthServerClient,
    private readonly contactsService: ContactsService,
  ) {}

  async listOrgMembers(organizationId: string): Promise<OrgMemberDto[]> {
    this.log.log(`${LOG_PREFIX}:listOrgMembers - Listing members for org ${organizationId}`);
    const rows = await this.usersRepository.listOrgMembers({ organizationId });
    return rows.map((row) => {
      const { givenName, familyName } = splitName(row.name);
      const roles =
        row.roles.length > 0
          ? row.roles
          : row.membershipRole
            ? [row.membershipRole]
            : [];
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        givenName,
        familyName,
        roles,
        status: row.status || row.membershipStatus || 'Active',
        joinedAt: row.joinedAt,
        lastLoginAt: row.status === 'Invited' ? null : row.updatedAt?.toISOString() ?? null,
        isActive: row.isActive,
      };
    });
  }

  async listAvailableRoles(accessToken: string): Promise<AvailableRoleDto[]> {
    this.log.log(`${LOG_PREFIX}:listAvailableRoles - Fetching role catalogue`);
    const roles = await this.authServerClient.listRoleCatalogue(accessToken, 'org');
    return roles.map((role) => ({
      key: role.roleName,
      name: role.label || role.roleName,
      description: role.description,
      scope: role.scope,
      isSystem: role.isSystem,
    }));
  }

  async inviteUser(
    organizationId: string,
    input: InviteUserInput,
    accessToken: string,
  ): Promise<OrgMemberDto> {
    const email = input.email.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException(`${LOG_PREFIX}:inviteUser - email is required`);
    }
    if (!input.roles?.length) {
      throw new BadRequestException(`${LOG_PREFIX}:inviteUser - roles are required`);
    }

    this.log.log(`${LOG_PREFIX}:inviteUser - Inviting ${email} to org ${organizationId}`);

    const invited = await this.authServerClient.inviteUser(
      {
        email,
        givenName: input.givenName,
        familyName: input.familyName,
        roles: input.roles,
      },
      accessToken,
    );

    try {
      await this.contactsService.ensureFromPerson({
        tenantId: organizationId,
        email: invited.email || email,
        firstName: invited.givenName ?? input.givenName,
        lastName: invited.familyName ?? input.familyName,
      });
    } catch (err) {
      this.log.warn(
        `${LOG_PREFIX}:inviteUser - ensure contact failed for ${email}: ${(err as Error).message}`,
      );
    }

    const members = await this.listOrgMembers(organizationId);
    const member = members.find((m) => m.id === invited.userId);
    if (member) return member;

    return {
      id: invited.userId,
      email: invited.email,
      name: [invited.givenName, invited.familyName].filter(Boolean).join(' ') || null,
      givenName: invited.givenName,
      familyName: invited.familyName,
      roles: invited.roles,
      status: invited.status,
      joinedAt: new Date().toISOString(),
      lastLoginAt: null,
      isActive: invited.status !== 'Disabled',
    };
  }

  async assignRoles(
    organizationId: string,
    userId: string,
    roles: string[],
    accessToken: string,
  ): Promise<OrgMemberDto> {
    if (!Array.isArray(roles) || roles.length === 0) {
      throw new BadRequestException(`${LOG_PREFIX}:assignRoles - roles must be a non-empty array`);
    }

    const membership = await this.usersRepository.findOrgMembership({
      userId,
      organizationId,
    });
    if (!membership) {
      throw new NotFoundException(`${LOG_PREFIX}:assignRoles - User is not a member of this organization`);
    }

    this.log.log(
      `${LOG_PREFIX}:assignRoles - Setting roles for user ${userId} in org ${organizationId}`,
    );
    await this.authServerClient.setUserRoles(userId, organizationId, roles, accessToken);

    const members = await this.listOrgMembers(organizationId);
    const member = members.find((m) => m.id === userId);
    if (!member) {
      throw new NotFoundException(`${LOG_PREFIX}:assignRoles - Member not found after role update`);
    }
    return member;
  }

  async removeMember(
    organizationId: string,
    userId: string,
    actorUserId: string,
  ): Promise<{ ok: boolean }> {
    if (userId === actorUserId) {
      throw new ForbiddenException(`${LOG_PREFIX}:removeMember - Cannot remove yourself`);
    }

    const removed = await this.usersRepository.removeOrgMembership({
      userId,
      organizationId,
    });
    if (!removed) {
      throw new NotFoundException(`${LOG_PREFIX}:removeMember - User is not a member of this organization`);
    }

    this.log.log(
      `${LOG_PREFIX}:removeMember - Removed user ${userId} from org ${organizationId}`,
    );
    return { ok: true };
  }

  async updateStatus(
    organizationId: string,
    userId: string,
    input: UpdateUserStatusInput,
    actorUserId: string,
  ): Promise<OrgMemberDto> {
    if (userId === actorUserId && input.status === 'Disabled') {
      throw new ForbiddenException(`${LOG_PREFIX}:updateStatus - Cannot disable yourself`);
    }

    const membership = await this.usersRepository.findOrgMembership({
      userId,
      organizationId,
    });
    if (!membership) {
      throw new NotFoundException(`${LOG_PREFIX}:updateStatus - User is not a member of this organization`);
    }

    if (input.status !== 'Active' && input.status !== 'Disabled') {
      throw new BadRequestException(`${LOG_PREFIX}:updateStatus - status must be Active or Disabled`);
    }

    await this.usersRepository.update({
      id: userId,
      data: {
        status: input.status,
        isActive: input.status === 'Active',
      },
    });

    this.log.log(
      `${LOG_PREFIX}:updateStatus - Set user ${userId} status to ${input.status}`,
    );

    const members = await this.listOrgMembers(organizationId);
    const member = members.find((m) => m.id === userId);
    if (!member) {
      throw new NotFoundException(`${LOG_PREFIX}:updateStatus - Member not found after status update`);
    }
    return member;
  }

  async updateUser(params: {
    organizationId: string;
    userId: string;
    input: UpdateUserInput;
    actorUserId: string;
    accessToken: string;
  }): Promise<OrgMemberDto> {
    const { organizationId, userId, input, actorUserId, accessToken } = params;

    const membership = await this.usersRepository.findOrgMembership({
      userId,
      organizationId,
    });
    if (!membership) {
      throw new NotFoundException(
        `${LOG_PREFIX}:updateUser - User is not a member of this organization`,
      );
    }

    if (input.status === 'Disabled' && userId === actorUserId) {
      throw new ForbiddenException(`${LOG_PREFIX}:updateUser - Cannot disable yourself`);
    }

    if (input.status !== undefined && input.status !== 'Active' && input.status !== 'Disabled') {
      throw new BadRequestException(
        `${LOG_PREFIX}:updateUser - status must be Active or Disabled`,
      );
    }

    if (input.roles !== undefined && (!Array.isArray(input.roles) || input.roles.length === 0)) {
      throw new BadRequestException(
        `${LOG_PREFIX}:updateUser - roles must be a non-empty array`,
      );
    }

    const existing = await this.usersRepository.findById({ id: userId });
    if (!existing) {
      throw new NotFoundException(`${LOG_PREFIX}:updateUser - User not found`);
    }

    const namePatch =
      input.givenName !== undefined || input.familyName !== undefined
        ? this.buildUpdatedName({
            currentName: existing.name,
            givenName: input.givenName,
            familyName: input.familyName,
          })
        : undefined;

    const currentStatus = (existing.status || '').toLowerCase();
    const nameChanged =
      namePatch !== undefined && (namePatch ?? '') !== (existing.name ?? '');
    const statusChanged =
      input.status !== undefined && currentStatus !== input.status.toLowerCase();

    if (nameChanged || statusChanged) {
      await this.usersRepository.update({
        id: userId,
        data: {
          ...(nameChanged ? { name: namePatch } : {}),
          ...(statusChanged
            ? { status: input.status, isActive: input.status === 'Active' }
            : {}),
        },
      });
    }

    if (input.roles) {
      this.log.log(
        `${LOG_PREFIX}:updateUser - Setting roles for user ${userId} in org ${organizationId}`,
      );
      await this.authServerClient.setUserRoles(
        userId,
        organizationId,
        input.roles,
        accessToken,
      );
    }

    this.log.log(`${LOG_PREFIX}:updateUser - Updated user ${userId}`);

    const members = await this.listOrgMembers(organizationId);
    const member = members.find((m) => m.id === userId);
    if (!member) {
      throw new NotFoundException(`${LOG_PREFIX}:updateUser - Member not found after update`);
    }
    return member;
  }

  private buildUpdatedName(params: {
    currentName: string | null;
    givenName?: string;
    familyName?: string;
  }): string | null {
    const current = splitName(params.currentName);
    const givenName =
      params.givenName !== undefined ? params.givenName.trim() : (current.givenName ?? '');
    const familyName =
      params.familyName !== undefined ? params.familyName.trim() : (current.familyName ?? '');
    return [givenName, familyName].filter(Boolean).join(' ') || null;
  }
}
