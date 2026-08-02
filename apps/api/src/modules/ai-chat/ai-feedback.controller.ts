import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  AiFeedbackService,
  type SubmitFeedbackDto,
} from './ai-feedback.service';

@ApiTags('ai-chat')
@Controller('ai-chat')
export class AiFeedbackController {
  constructor(private readonly feedbackService: AiFeedbackService) {}

  @Post('feedback')
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Submit message feedback' })
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SubmitFeedbackDto,
  ) {
    return this.feedbackService.submit(user.sub, body);
  }

  @Get('feedback/:conversationId')
  @RequirePermission('ai.read')
  @ApiOperation({ summary: 'List feedback for a conversation' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
  ) {
    return this.feedbackService.listForConversation(user.sub, conversationId);
  }
}
