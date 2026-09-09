import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

/** Job-scoped internal notes, surfaced under Communications. */
@Module({
  imports: [TenantModule],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}
