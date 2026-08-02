import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { DrizzleModule } from '../../database/drizzle.module';
import { TenantModule } from '../../tenant/tenant.module';
import { AgentsModule } from '../agents/agents.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { McpIntegrationModule } from '../mcp-integration/mcp-integration.module';
import { SkillsModule } from '../skills/skills.module';
import { AiCanvasController } from './ai-canvas.controller';
import { AiCanvasService } from './ai-canvas.service';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { AiFeedbackController } from './ai-feedback.controller';
import { AiFeedbackService } from './ai-feedback.service';
import { AiFileUploadService } from './ai-file-upload.service';
import { AiMemoryController } from './ai-memory.controller';
import { AiMemoryService } from './ai-memory.service';
import { AiScheduledTasksController } from './ai-scheduled-tasks.controller';
import { AiScheduledTasksService } from './ai-scheduled-tasks.service';
import { AiSettingsController } from './ai-settings.controller';
import { AiSettingsService } from './ai-settings.service';

@Module({
  imports: [
    ConfigModule,
    DrizzleModule,
    TenantModule,
    AgentsModule,
    ConversationsModule,
    McpIntegrationModule,
    SkillsModule,
    MulterModule.register({ limits: { fileSize: 20 * 1024 * 1024 } }),
  ],
  controllers: [
    AiChatController,
    AiCanvasController,
    AiSettingsController,
    AiFeedbackController,
    AiMemoryController,
    AiScheduledTasksController,
  ],
  providers: [
    AiChatService,
    AiCanvasService,
    AiFileUploadService,
    AiSettingsService,
    AiFeedbackService,
    AiMemoryService,
    AiScheduledTasksService,
  ],
  exports: [AiChatService, AiCanvasService, AiFileUploadService, AiSettingsService, AiFeedbackService, AiMemoryService, AiScheduledTasksService],
})
export class AiChatModule {}
