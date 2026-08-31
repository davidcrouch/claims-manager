import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { FilesystemModule } from '../filesystem/filesystem.module';
import { JournalsController } from './journals.controller';
import { JournalsService } from './journals.service';
import { JournalImageGenerationService } from './journal-image-generation.service';

@Module({
  imports: [TenantModule, FilesystemModule],
  controllers: [JournalsController],
  providers: [JournalsService, JournalImageGenerationService],
  exports: [JournalsService],
})
export class JournalsModule {}
