import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { CommunicationsModule } from '../communications/communications.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [TenantModule, CommunicationsModule],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
