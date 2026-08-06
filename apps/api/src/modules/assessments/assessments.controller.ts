import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto, UpdateAssessmentDto } from './dto';

@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('jobId') jobId?: string,
  ) {
    return this.assessmentsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      jobId,
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assessmentsService.findOne({ id });
  }

  @Post()
  async create(
    @Body() dto: CreateAssessmentDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.assessmentsService.create({ dto, userId });
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssessmentDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.assessmentsService.update({ id, dto, userId });
  }

  @Delete(':id')
  async softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.assessmentsService.softDelete({ id });
  }
}
