import { Global, Module } from '@nestjs/common';
import { RecordNumberService } from './record-number.service';

@Global()
@Module({
  providers: [RecordNumberService],
  exports: [RecordNumberService],
})
export class RecordNumberModule {}
