import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExternalToolsController } from './external-tools.controller';
import { ToolAuthGuard } from './tool-auth.guard';
import { ExternalModule } from '../external.module';
import { CrunchworkModule } from '../../../crunchwork/crunchwork.module';
import more0Config from '../../../config/more0.config';

@Module({
  imports: [
    ConfigModule.forFeature(more0Config),
    ExternalModule,
    CrunchworkModule,
  ],
  controllers: [ExternalToolsController],
  providers: [ToolAuthGuard],
})
export class ExternalToolsModule {}
