import { Module, forwardRef } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { CrunchworkModule } from '../../crunchwork/crunchwork.module';
import { ExternalModule } from '../external/external.module';
import { GcsModule } from '../../common/gcs/gcs.module';
import { FilesystemModule } from '../filesystem/filesystem.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({
  imports: [
    TenantModule,
    CrunchworkModule,
    forwardRef(() => ExternalModule),
    GcsModule,
    FilesystemModule,
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}