import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { FilesystemModule } from '../filesystem/filesystem.module';
import { DocumentGenerationModule } from '../document-generation/document-generation.module';
import { ProvisioningController } from './provisioning.controller';
import { ProvisioningService } from './provisioning.service';

@Module({
  imports: [TenantModule, FilesystemModule, DocumentGenerationModule],
  controllers: [ProvisioningController],
  providers: [ProvisioningService],
  exports: [ProvisioningService],
})
export class ProvisioningModule {}
