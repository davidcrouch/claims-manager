import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { McpIntegrationModule } from '../mcp-integration/mcp-integration.module';
import { CapabilityPacksController } from './capability-packs.controller';
import { PackCatalogService } from './pack-catalog.service';
import { PackInstallService } from './pack-install.service';
import { PackResolverService } from './pack-resolver.service';

@Module({
  imports: [TenantModule, McpIntegrationModule],
  controllers: [CapabilityPacksController],
  providers: [PackCatalogService, PackInstallService, PackResolverService],
  exports: [PackInstallService, PackCatalogService],
})
export class CapabilityPacksModule {}
