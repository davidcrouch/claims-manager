import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { AiCanvasService } from './ai-canvas.service';

@ApiTags('ai-chat')
@Controller('ai-chat/canvas')
export class AiCanvasController {
  private readonly logger = new Logger(AiCanvasController.name);

  constructor(private readonly canvasService: AiCanvasService) {}

  @Post()
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Create a canvas artifact' })
  async create(
    @Body()
    body: {
      conversationId: string;
      title: string;
      contentType?: string;
      content: string;
      language?: string;
      componentName?: string;
      componentProps?: Record<string, unknown>;
    },
  ) {
    this.logger.log(
      `[AiCanvasController.create] conversation=${body.conversationId} title=${body.title}`,
    );
    return this.canvasService.createArtifact(body);
  }

  @Get(':id')
  @RequirePermission('ai.read')
  @ApiOperation({ summary: 'Get a canvas artifact' })
  async get(@Param('id') id: string) {
    this.logger.log(`[AiCanvasController.get] id=${id}`);
    const artifact = await this.canvasService.getArtifact(id);
    if (!artifact) throw new NotFoundException();
    return artifact;
  }

  @Put(':id')
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Update a canvas artifact (creates new version)' })
  async update(@Param('id') id: string, @Body() body: { content: string }) {
    this.logger.log(`[AiCanvasController.update] id=${id}`);
    const updated = await this.canvasService.updateArtifact(id, body.content);
    if (!updated) throw new NotFoundException();
    return updated;
  }

  @Delete(':id')
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Delete a canvas artifact' })
  async remove(@Param('id') id: string) {
    this.logger.log(`[AiCanvasController.delete] id=${id}`);
    const deleted = await this.canvasService.deleteArtifact(id);
    if (!deleted) throw new NotFoundException();
    return { deleted: true };
  }

  @Get('conversation/:conversationId')
  @RequirePermission('ai.read')
  @ApiOperation({ summary: 'List canvas artifacts for a conversation' })
  async listByConversation(@Param('conversationId') conversationId: string) {
    this.logger.log(
      `[AiCanvasController.listByConversation] conversation=${conversationId}`,
    );
    return this.canvasService.listByConversation(conversationId);
  }
}
