import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { CreateFeedbackNoteDto } from './dto/create-feedback-note.dto';
import { UpdateFeedbackNoteDto } from './dto/update-feedback-note.dto';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { P } from '../../auth/permission-constants';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  @RequirePermission(P.feedback.read)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.feedbackService.findAll({
      type,
      status,
      priority,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      actor: { userId: user.sub, email: user.email },
    });
  }

  @Get('stats')
  @RequirePermission(P.feedback.read)
  async getStats() {
    return this.feedbackService.getStats();
  }

  @Get(':id')
  @RequirePermission(P.feedback.read)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedbackService.findOne({
      id,
      actor: { userId: user.sub, email: user.email },
    });
  }

  @Post()
  @RequirePermission(P.ai.manage)
  async create(
    @Body() dto: CreateFeedbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedbackService.create({
      dto,
      userId: user.sub,
      email: user.email,
    });
  }

  @Patch(':id')
  @RequirePermission(P.feedback.manage)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeedbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedbackService.update({
      id,
      dto,
      actor: { userId: user.sub, email: user.email },
    });
  }

  @Delete(':id')
  @RequirePermission(P.feedback.manage)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.feedbackService.remove({ id });
  }

  @Post(':id/notes')
  @RequirePermission(P.feedback.manage)
  async addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFeedbackNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedbackService.addNote({
      feedbackId: id,
      body: dto.body,
      actor: { userId: user.sub, email: user.email },
    });
  }

  @Patch(':id/notes/:noteId')
  @RequirePermission(P.feedback.manage)
  async updateNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateFeedbackNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedbackService.updateNote({
      feedbackId: id,
      noteId,
      body: dto.body,
      actor: { userId: user.sub, email: user.email },
    });
  }

  @Delete(':id/notes/:noteId')
  @RequirePermission(P.feedback.manage)
  async deleteNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedbackService.deleteNote({
      feedbackId: id,
      noteId,
      actor: { userId: user.sub, email: user.email },
    });
  }
}
