import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { TenantContext } from '../../tenant/tenant-context';
import { McpIntegrationService } from './mcp-integration.service';
import { McpOAuthService } from './mcp-oauth.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
import type {
  CreateConnectionDto,
  CreateIntegrationDto,
  DiscoverServerDto,
  InitiateOAuthDto,
  TestConnectionDto,
  UpdateIntegrationDto,
} from './mcp-integration.types';

@ApiTags('mcp-integrations')
@Controller('mcp-integrations')
export class McpIntegrationController {
  constructor(private readonly service: McpIntegrationService) {}

  @Get()
  @RequirePermission(P.integrations.read)
  @ApiOperation({ summary: 'List MCP integrations visible to caller' })
  async listIntegrations(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listIntegrations(user.sub);
  }

  @Post()
  @RequirePermission(P.integrations.manage)
  @ApiOperation({ summary: 'Create MCP integration' })
  async createIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateIntegrationDto,
  ) {
    return this.service.createIntegration(user, body);
  }

  @Post('discover')
  @RequirePermission(P.integrations.manage)
  @ApiOperation({ summary: 'Discover MCP server auth requirements' })
  async discoverServer(@Body() body: DiscoverServerDto) {
    return this.service.discoverServerAuth(body);
  }

  @Post('test-connection')
  @RequirePermission(P.integrations.manage)
  @ApiOperation({ summary: 'Test connection to an MCP URL (stateless probe)' })
  async testConnectionStateless(
    @Req() req: Request,
    @Body() body: TestConnectionDto,
  ) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    return this.service.testConnectionStateless({
      ...body,
      bearerToken: body.bearerToken ?? token,
    });
  }

  @Get(':id')
  @RequirePermission(P.integrations.read)
  @ApiOperation({ summary: 'Get MCP integration details' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  async getIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.getIntegration(id, user.sub);
  }

  @Patch(':id')
  @RequirePermission(P.integrations.manage)
  @ApiOperation({ summary: 'Update MCP integration' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  async updateIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateIntegrationDto,
  ) {
    return this.service.updateIntegration(id, user, body);
  }

  @Delete(':id')
  @RequirePermission(P.integrations.manage)
  @ApiOperation({ summary: 'Delete MCP integration' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  async deleteIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const deleted = await this.service.deleteIntegration(id, user);
    if (!deleted) {
      throw new NotFoundException(
        '[McpIntegrationController.deleteIntegration] integration not found',
      );
    }
    return { ok: true };
  }
}

@ApiTags('mcp-connections')
@Controller('mcp-connections')
export class McpConnectionsController {
  constructor(
    private readonly service: McpIntegrationService,
    private readonly oauthService: McpOAuthService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Get()
  @RequirePermission(P.integrations.read)
  @ApiOperation({ summary: 'List MCP connections for tenant' })
  async listConnections(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listConnections(user.sub);
  }

  @Post('initiate-oauth')
  @RequirePermission(P.integrations.manage)
  @ApiOperation({ summary: 'Generate authorize URL and store OAuth state + PKCE' })
  async initiateOAuth(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: InitiateOAuthDto,
  ) {
    return this.oauthService.initiateOAuth(
      this.tenantContext.getTenantId(),
      user.sub,
      body,
    );
  }

  @Post()
  @RequirePermission(P.integrations.manage)
  @ApiOperation({ summary: 'Create MCP connection' })
  async createConnection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateConnectionDto,
  ) {
    return this.service.createConnection(user.sub, body);
  }

  @Post(':id/test')
  @RequirePermission(P.integrations.manage)
  @ApiOperation({ summary: 'Test existing connection and refresh manifest' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  async testConnection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    return this.service.testConnection(id, user.sub, token);
  }

  @Post(':id/disconnect')
  @RequirePermission(P.integrations.manage)
  @ApiOperation({ summary: 'Disconnect (soft-delete) MCP connection' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  async disconnectConnection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.service.disconnectConnection(id, user.sub);
    return { ok: true };
  }

}

@ApiTags('mcp-tools')
@Controller('mcp-tools')
export class McpToolsController {
  constructor(private readonly service: McpIntegrationService) {}

  @Get()
  @RequirePermission(P.integrations.read)
  @ApiOperation({ summary: 'List tools from cached manifests for active connections' })
  async listTools(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listToolsForUser(user.sub);
  }

  @Post('refresh')
  @RequirePermission(P.integrations.manage)
  @ApiOperation({ summary: 'Force re-discovery for a specific connection' })
  async refreshTools(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { connectionId: string },
    @Headers('authorization') authorization?: string,
  ) {
    if (!body.connectionId) {
      throw new BadRequestException(
        '[McpToolsController.refreshTools] connectionId is required',
      );
    }
    const token = authorization?.replace(/^Bearer\s+/i, '');
    return this.service.testConnection(body.connectionId, user.sub, token);
  }
}
