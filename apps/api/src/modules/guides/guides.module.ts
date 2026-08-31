import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from '../../database/drizzle.module';
import { TenantModule } from '../../tenant/tenant.module';
import { GuideController } from './guide.controller';
import { GuideService } from './guide.service';
import { GuideRepository } from '../../database/repositories/guide.repository';
import { EmbeddingService } from '../ai-chat/embedding.service';

@Module({
  imports: [ConfigModule, DrizzleModule, TenantModule],
  controllers: [GuideController],
  providers: [GuideService, GuideRepository, EmbeddingService],
  exports: [GuideService, GuideRepository],
})
export class GuidesModule {}
