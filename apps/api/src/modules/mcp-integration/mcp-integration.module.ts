import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TenantModule } from '../../tenant/tenant.module';
import {
  McpConnectionsController,
  McpIntegrationController,
  McpToolsController,
} from './mcp-integration.controller';
import { McpOAuthController } from './mcp-oauth.controller';
import { McpIntegrationService } from './mcp-integration.service';
import { McpOAuthService } from './mcp-oauth.service';
import { McpToolManifestService } from './mcp-tool-manifest.service';

@Module({
  imports: [TenantModule, ConfigModule],
  controllers: [
    McpIntegrationController,
    McpConnectionsController,
    McpToolsController,
    McpOAuthController,
  ],
  providers: [McpIntegrationService, McpOAuthService, McpToolManifestService],
  exports: [McpIntegrationService, McpOAuthService, McpToolManifestService],
})
export class McpIntegrationModule {}
