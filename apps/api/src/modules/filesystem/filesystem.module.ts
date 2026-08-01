import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { FilesystemTemplatesController } from './filesystem-templates.controller';
import { FilesystemTemplatesService } from './filesystem-templates.service';
import { FilesystemController } from './filesystem.controller';
import { FilesystemService } from './filesystem.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { FilesystemTemplatesRepository } from '../../database/repositories/filesystem-templates.repository';
import { FilesystemsRepository } from '../../database/repositories/filesystems.repository';
import { DocumentsRepository } from '../../database/repositories/documents.repository';

@Module({
  imports: [TenantModule],
  controllers: [FilesystemTemplatesController, FilesystemController, DocumentsController],
  providers: [
    FilesystemTemplatesService,
    FilesystemService,
    DocumentsService,
    FilesystemTemplatesRepository,
    FilesystemsRepository,
    DocumentsRepository,
  ],
  exports: [DocumentsService, FilesystemService],
})
export class FilesystemModule {}
