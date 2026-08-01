import { Global, Module } from '@nestjs/common';
import { GcsStorageService } from './gcs-storage.service';

@Global()
@Module({
  providers: [GcsStorageService],
  exports: [GcsStorageService],
})
export class GcsModule {}
