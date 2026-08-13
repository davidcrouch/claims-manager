import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto, UpdateAssessmentDto } from './dto';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Get()
  @RequirePermission(P.assessments.read)
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
  @RequirePermission(P.assessments.read)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assessmentsService.findOne({ id });
  }

  @Post()
  @RequirePermission(P.assessments.manage)
  async create(
    @Body() dto: CreateAssessmentDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.assessmentsService.create({ dto, userId });
  }

  @Patch(':id')
  @RequirePermission(P.assessments.manage)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssessmentDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.assessmentsService.update({ id, dto, userId });
  }

  @Post(':id/validate')
  @RequirePermission(P.assessments.manage)
  async validate(@Param('id', ParseUUIDPipe) id: string) {
    return this.assessmentsService.validate({ id });
  }

  @Post(':id/publish')
  @RequirePermission(P.assessments.manage)
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.assessmentsService.publish({ id, userId });
  }

  @Delete(':id')
  @RequirePermission(P.assessments.manage)
  async softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.assessmentsService.softDelete({ id });
  }
}
