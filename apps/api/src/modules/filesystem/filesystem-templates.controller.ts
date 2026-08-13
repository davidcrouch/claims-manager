import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { FilesystemTemplatesService } from './filesystem-templates.service';
import {
  CreateFilesystemTemplateDto,
  UpdateFilesystemTemplateDto,
  ReplaceCategoriesDto,
} from './dto';
import type { FilesystemTemplateKind } from '../../database/schema';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('filesystem-templates')
export class FilesystemTemplatesController {
  constructor(private readonly templatesService: FilesystemTemplatesService) {}

  @Get()
  @RequirePermission(P.filesystems.read)
  async findAll(@Query('kind') kind?: FilesystemTemplateKind) {
    return this.templatesService.findAll(kind);
  }

  @Post()
  @RequirePermission(P.filesystems.manage)
  async create(@Body() dto: CreateFilesystemTemplateDto) {
    return this.templatesService.create(dto);
  }

  @Get(':id')
  @RequirePermission(P.filesystems.read)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.findOne(id);
  }

  @Post(':id/clone')
  @RequirePermission(P.filesystems.manage)
  async clone(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.cloneForTenant(id);
  }

  @Put(':id')
  @RequirePermission(P.filesystems.manage)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFilesystemTemplateDto,
  ) {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(P.filesystems.manage)
  async archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.archive(id);
  }

  @Put(':id/categories')
  @RequirePermission(P.filesystems.manage)
  async replaceCategories(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceCategoriesDto,
  ) {
    return this.templatesService.replaceCategories(id, dto);
  }

  @Get(':id/pipelines')
  @RequirePermission(P.filesystems.read)
  async listPipelines(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.listPipelines(id);
  }

  @Post(':id/pipelines')
  @RequirePermission(P.filesystems.manage)
  async createPipeline(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      name: string;
      description?: string | null;
      isActive?: boolean;
      triggerOn?: string;
      categoryId?: string | null;
      sortOrder?: number;
    },
  ) {
    return this.templatesService.createPipeline(id, body);
  }

  @Get(':id/pipelines/:pipelineId')
  @RequirePermission(P.filesystems.read)
  async getPipeline(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
  ) {
    return this.templatesService.getPipeline(id, pipelineId);
  }

  @Put(':id/pipelines/:pipelineId')
  @RequirePermission(P.filesystems.manage)
  async updatePipeline(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
    @Body()
    body: {
      name?: string;
      description?: string | null;
      isActive?: boolean;
      triggerOn?: string;
      categoryId?: string | null;
      sortOrder?: number;
    },
  ) {
    return this.templatesService.updatePipeline(id, pipelineId, body);
  }

  @Delete(':id/pipelines/:pipelineId')
  @RequirePermission(P.filesystems.manage)
  async deletePipeline(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
  ) {
    return this.templatesService.deletePipeline(id, pipelineId);
  }

  @Put(':id/pipelines/:pipelineId/steps')
  @RequirePermission(P.filesystems.manage)
  async replacePipelineSteps(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
    @Body() body: { steps?: Array<{ agentId: string; stepOrder: number; config?: Record<string, unknown> }> },
  ) {
    return this.templatesService.replacePipelineSteps(id, pipelineId, body.steps ?? []);
  }
}
