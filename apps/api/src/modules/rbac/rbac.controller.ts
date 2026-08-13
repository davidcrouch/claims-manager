import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

const LOG_PREFIX = 'api.RbacController';

function bearerToken(req: Request): string {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new UnauthorizedException(
      `${LOG_PREFIX}.bearerToken - Bearer token required`,
    );
  }
  return `Bearer ${token}`;
}

function authServerUrl(): string {
  const url = (
    process.env.AUTH_SERVER_URL ??
    process.env.AUTH_ISSUER_URL ??
    ''
  ).replace(/\/+$/, '');
  if (!url) {
    throw new InternalServerErrorException(
      `${LOG_PREFIX}.authServerUrl - AUTH_SERVER_URL is not configured`,
    );
  }
  return url;
}

function unwrap(data: unknown): unknown {
  if (data && typeof data === 'object' && 'data' in data) {
    return (data as { data: unknown }).data;
  }
  return data;
}

async function proxyToAuthServer(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const url = `${authServerUrl()}${path}`;
  const init: RequestInit = {
    method,
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  if (res.status === 204) {
    return { status: 204, data: null };
  }
  const data = res.headers.get('content-type')?.includes('json')
    ? await res.json()
    : await res.text();
  return { status: res.status, data };
}

function throwOnError(result: { status: number; data: unknown }): void {
  if (result.status >= 200 && result.status < 300) return;
  const msg =
    typeof result.data === 'object' && result.data !== null
      ? ((result.data as { error_description?: string; message?: string })
          .error_description ??
        (result.data as { message?: string }).message ??
        JSON.stringify(result.data))
      : String(result.data);
  if (result.status === 403) throw new ForbiddenException(msg);
  if (result.status === 404) throw new NotFoundException(msg);
  if (result.status === 400) throw new BadRequestException(msg);
  throw new InternalServerErrorException(msg);
}

@ApiTags('admin-rbac')
@Controller('admin')
export class RbacController {
  @Get('permissions')
  @RequirePermission(P.org.roles.read)
  @ApiOperation({ summary: 'List permission catalogue' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'scope', required: false })
  async listPermissions(
    @Req() req: Request,
    @Query('category') category?: string,
    @Query('scope') scope?: string,
  ) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (scope) params.set('scope', scope);
    const qs = params.toString() ? `?${params}` : '';
    const result = await proxyToAuthServer(
      'GET',
      `/admin/permissions${qs}`,
      bearerToken(req),
    );
    throwOnError(result);
    return unwrap(result.data);
  }

  @Post('permissions')
  @RequirePermission(P.platform.permissions.manage)
  @ApiOperation({ summary: 'Create permission definition' })
  async createPermission(@Req() req: Request, @Body() body: unknown) {
    const result = await proxyToAuthServer(
      'POST',
      '/admin/permissions',
      bearerToken(req),
      body,
    );
    throwOnError(result);
    return unwrap(result.data);
  }

  @Patch('permissions/:permissionId')
  @RequirePermission(P.platform.permissions.manage)
  @ApiOperation({ summary: 'Update permission definition' })
  async updatePermission(
    @Req() req: Request,
    @Param('permissionId') permissionId: string,
    @Body() body: unknown,
  ) {
    const result = await proxyToAuthServer(
      'PATCH',
      `/admin/permissions/${encodeURIComponent(permissionId)}`,
      bearerToken(req),
      body,
    );
    throwOnError(result);
    return unwrap(result.data);
  }

  @Delete('permissions/:permissionId')
  @RequirePermission(P.platform.permissions.manage)
  @ApiOperation({ summary: 'Delete permission definition' })
  async deletePermission(
    @Req() req: Request,
    @Param('permissionId') permissionId: string,
  ) {
    const result = await proxyToAuthServer(
      'DELETE',
      `/admin/permissions/${encodeURIComponent(permissionId)}`,
      bearerToken(req),
    );
    throwOnError(result);
    return { ok: true };
  }

  @Get('roles')
  @RequirePermission(P.org.roles.read)
  @ApiOperation({ summary: 'List role catalogue' })
  @ApiQuery({ name: 'scope', required: false })
  async listRoles(@Req() req: Request, @Query('scope') scope?: string) {
    const qs = scope ? `?scope=${encodeURIComponent(scope)}` : '';
    const result = await proxyToAuthServer(
      'GET',
      `/admin/roles${qs}`,
      bearerToken(req),
    );
    throwOnError(result);
    return unwrap(result.data);
  }

  @Post('roles')
  @RequirePermission(P.org.roles.create)
  @ApiOperation({ summary: 'Create role definition' })
  async createRole(@Req() req: Request, @Body() body: unknown) {
    const result = await proxyToAuthServer(
      'POST',
      '/admin/roles',
      bearerToken(req),
      body,
    );
    throwOnError(result);
    return unwrap(result.data);
  }

  @Patch('roles/:roleId')
  @RequirePermission(P.org.roles.update)
  @ApiOperation({ summary: 'Update role definition' })
  async updateRole(
    @Req() req: Request,
    @Param('roleId') roleId: string,
    @Body() body: unknown,
  ) {
    const result = await proxyToAuthServer(
      'PATCH',
      `/admin/roles/${encodeURIComponent(roleId)}`,
      bearerToken(req),
      body,
    );
    throwOnError(result);
    return unwrap(result.data);
  }

  @Delete('roles/:roleId')
  @RequirePermission(P.org.roles.delete)
  @ApiOperation({ summary: 'Delete role definition' })
  async deleteRole(@Req() req: Request, @Param('roleId') roleId: string) {
    const result = await proxyToAuthServer(
      'DELETE',
      `/admin/roles/${encodeURIComponent(roleId)}`,
      bearerToken(req),
    );
    throwOnError(result);
    return { ok: true };
  }

  @Get('roles/:roleId/permissions')
  @RequirePermission(P.org.roles.read)
  @ApiOperation({ summary: 'List permissions assigned to a role' })
  async getRolePermissions(
    @Req() req: Request,
    @Param('roleId') roleId: string,
  ) {
    const result = await proxyToAuthServer(
      'GET',
      `/admin/roles/${encodeURIComponent(roleId)}/permissions`,
      bearerToken(req),
    );
    throwOnError(result);
    return unwrap(result.data);
  }

  @Put('roles/:roleId/permissions')
  @RequirePermission(P.org.roles.update)
  @ApiOperation({ summary: 'Replace permissions for a role' })
  async setRolePermissions(
    @Req() req: Request,
    @Param('roleId') roleId: string,
    @Body() body: { permissionIds: string[] },
  ) {
    const result = await proxyToAuthServer(
      'PUT',
      `/admin/roles/${encodeURIComponent(roleId)}/permissions`,
      bearerToken(req),
      body,
    );
    throwOnError(result);
    return unwrap(result.data);
  }
}
