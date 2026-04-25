import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';
import { InternalTokenGuard } from './internal-token.guard';

@Module({
  controllers: [InternalController],
  providers: [InternalService, InternalTokenGuard],
  exports: [InternalService],
})
export class InternalModule {}
