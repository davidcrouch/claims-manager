import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { FilesystemTemplatesService } from './filesystem-templates.service';
import {
  CreateFilesystemTemplateDto,
  UpdateFilesystemTemplateDto,
  ReplaceCategoriesDto,
} from './dto';
import type { FilesystemTemplateKind } from '../../database/schema';

@Controller('filesystem-templates')
export class FilesystemTemplatesController {
  constructor(private readonly templatesService: FilesystemTemplatesService) {}

  @Get()
  async findAll(@Query('kind') kind?: FilesystemTemplateKind) {
    return this.templatesService.findAll(kind);
  }

  @Post()
  async create(@Body() dto: CreateFilesystemTemplateDto) {
    return this.templatesService.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.findOne(id);
  }

  @Post(':id/clone')
  async clone(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.cloneForTenant(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFilesystemTemplateDto,
  ) {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  async archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.archive(id);
  }

  @Put(':id/categories')
  async replaceCategories(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceCategoriesDto,
  ) {
    return this.templatesService.replaceCategories(id, dto);
  }

  @Get(':id/pipelines')
  async listPipelines(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.listPipelines(id);
  }

  @Post(':id/pipelines')
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
  async getPipeline(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
  ) {
    return this.templatesService.getPipeline(id, pipelineId);
  }

  @Put(':id/pipelines/:pipelineId')
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
  async deletePipeline(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
  ) {
    return this.templatesService.deletePipeline(id, pipelineId);
  }

  @Put(':id/pipelines/:pipelineId/steps')
  async replacePipelineSteps(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
    @Body() body: { steps?: Array<{ agentId: string; stepOrder: number; config?: Record<string, unknown> }> },
  ) {
    return this.templatesService.replacePipelineSteps(id, pipelineId, body.steps ?? []);
  }
}
