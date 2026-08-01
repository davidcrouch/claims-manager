import { Global, Module } from '@nestjs/common';
import { OfficeConverterService } from './office-converter.service';

@Global()
@Module({
  providers: [OfficeConverterService],
  exports: [OfficeConverterService],
})
export class OfficeModule {}
