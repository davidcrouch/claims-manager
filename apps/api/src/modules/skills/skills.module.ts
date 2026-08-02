import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TenantModule } from '../../tenant/tenant.module';
import { SkillController } from './skill.controller';
import { SkillMatcherService } from './skill-matcher.service';
import { SkillService } from './skill.service';
import { EmbeddingService } from '../ai-chat/embedding.service';

@Module({
  imports: [TenantModule, ConfigModule],
  controllers: [SkillController],
  providers: [SkillService, SkillMatcherService, EmbeddingService],
  exports: [SkillService, SkillMatcherService, EmbeddingService],
})
export class SkillsModule {}
