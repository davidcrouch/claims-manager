import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AiChatService } from './ai-chat.service';
import { AiFileUploadService } from './ai-file-upload.service';
import type { StreamChatDto } from './ai-chat.types';

@ApiTags('ai-chat')
@Controller('ai-chat')
export class AiChatController {
  private readonly logger = new Logger(AiChatController.name);

  constructor(
    private readonly chatService: AiChatService,
    private readonly fileUploadService: AiFileUploadService,
  ) {}

  @Post('stream')
  @RequirePermission(P.ai.manage)
  @ApiOperation({ summary: 'Stream AI chat completion (SSE)' })
  async stream(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: StreamChatDto,
  ) {
    const bearerToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      for await (const event of this.chatService.streamChat({
        user,
        bearerToken,
        dto: body,
      })) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[AiChatController.stream] stream failed: ${message}`);

      if (!res.headersSent) {
        res.status(500).json({
          error: 'AI chat stream failed',
          message,
        });
      } else {
        res.write(
          `data: ${JSON.stringify({ type: 'error', message })}\n\n`,
        );
        res.end();
      }
    }
  }

  @Post('upload')
  @RequirePermission(P.ai.manage)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file attachment for chat' })
  async uploadFile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { conversationId: string },
  ) {
    if (!file) {
      throw new BadRequestException('[AiChatController.uploadFile] no file provided');
    }

    this.logger.log(
      `[AiChatController.uploadFile] user=${user.sub} conversationId=${body.conversationId} filename=${file.originalname}`,
    );

    return this.fileUploadService.uploadFile({
      userId: user.sub,
      conversationId: body.conversationId,
      file: {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
    });
  }

  @Get('signed-url')
  @RequirePermission(P.ai.read)
  @ApiOperation({ summary: 'Get a signed download URL for a chat attachment' })
  async getSignedUrl(@Query('uri') uri: string) {
    if (!uri) {
      throw new BadRequestException('[AiChatController.getSignedUrl] uri query parameter required');
    }
    const url = await this.fileUploadService.getSignedUrl(uri);
    return { url };
  }

  @Get('models')
  @RequirePermission(P.ai.read)
  @ApiOperation({ summary: 'List supported AI models' })
  getModels() {
    return this.chatService.getModels();
  }

  @Get('audit')
  @RequirePermission(P.ai.manage)
  @ApiOperation({ summary: 'List AI message audit records (admin)' })
  async getAudit(
    @Query('userId') userId?: string,
    @Query('model') model?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.listAudit({
      userId,
      model,
      status,
      dateFrom,
      dateTo,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('audit/conversation/:conversationId')
  @RequirePermission(P.ai.manage)
  @ApiOperation({ summary: 'List AI message audit records for a conversation' })
  async getConversationAudit(@Param('conversationId') conversationId: string) {
    return this.chatService.listConversationAudit(conversationId);
  }
}
