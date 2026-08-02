import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { ConversationsService } from './conversations.service';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(private readonly service: ConversationsService) {}

  @Get()
  @RequirePermission('ai.read')
  @ApiOperation({ summary: 'List conversations for current user' })
  @ApiQuery({ name: 'search', required: false })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
  ) {
    return this.service.list(user.sub, search);
  }

  @Get('shared/:token')
  @ApiOperation({ summary: 'Get a shared conversation by token (public)' })
  @ApiParam({ name: 'token', description: 'Share token' })
  async getShared(@Param('token') token: string) {
    const conversation = await this.service.getSharedConversation(token);
    if (!conversation) {
      return { error: 'Share link invalid or expired' };
    }
    return conversation;
  }

  @Get(':id')
  @RequirePermission('ai.read')
  @ApiOperation({ summary: 'Get a single conversation with messages' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.getById(user.sub, id);
  }

  @Post()
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Create a new conversation' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      title?: string;
      id?: string;
      agentId?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
    },
  ) {
    return this.service.create(
      user.sub,
      body.title,
      body.id,
      body.agentId,
      body.relatedEntityType,
      body.relatedEntityId,
    );
  }

  @Patch(':id')
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Update conversation (title, messages, pin, entity)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      messages?: unknown[];
      agentId?: string;
      pinned?: boolean;
      relatedEntityType?: string;
      relatedEntityId?: string;
    },
  ) {
    return this.service.update(user.sub, id, body);
  }

  @Post(':id/share')
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Create a shareable link for a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  async createShare(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { expiresInDays?: number },
  ) {
    return this.service.createShare(user.sub, id, body.expiresInDays);
  }

  @Delete(':id')
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.delete(user.sub, id);
  }
}
