import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserManagementService } from './user-management.service';
import type {
  InviteUserInput,
  UpdateUserRolesInput,
  UpdateUserStatusInput,
} from './user-management.types';

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new UnauthorizedException(
      '[UserManagementController.extractBearerToken] Bearer token required',
    );
  }
  return token;
}

@ApiTags('admin/users')
@Controller('admin/users')
export class UserManagementController {
  constructor(private readonly service: UserManagementService) {}

  @Get('roles')
  @RequirePermission('org.users.manage')
  @ApiOperation({ summary: 'List available org roles' })
  async listRoles(@Req() req: Request) {
    return this.service.listAvailableRoles(extractBearerToken(req));
  }

  @Get()
  @RequirePermission('org.users.manage')
  @ApiOperation({ summary: 'List organization members' })
  async listOrgMembers(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listOrgMembers(user.tenantId);
  }

  @Post('invite')
  @RequirePermission('org.users.manage')
  @ApiOperation({ summary: 'Invite a user to the organization' })
  async inviteUser(
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: InviteUserInput,
  ) {
    return this.service.inviteUser(user.tenantId, body, extractBearerToken(req));
  }

  @Patch(':userId/roles')
  @RequirePermission('org.users.manage')
  @ApiOperation({ summary: 'Update user roles in the organization' })
  async assignRoles(
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: UpdateUserRolesInput,
  ) {
    return this.service.assignRoles(
      user.tenantId,
      userId,
      body.roles ?? [],
      extractBearerToken(req),
    );
  }

  @Patch(':userId/status')
  @RequirePermission('org.users.manage')
  @ApiOperation({ summary: 'Enable or disable a user' })
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: UpdateUserStatusInput,
  ) {
    return this.service.updateStatus(user.tenantId, userId, body, user.sub);
  }

  @Delete(':userId')
  @RequirePermission('org.users.manage')
  @ApiOperation({ summary: 'Remove a user from the organization' })
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.service.removeMember(user.tenantId, userId, user.sub);
  }
}
