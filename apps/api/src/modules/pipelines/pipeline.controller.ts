import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { TenantContext } from '../../tenant/tenant-context';
import type { CreatePipelineDto, UpdatePipelineDto, PipelineStepInput } from './pipeline.types';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('pipelines')
export class PipelineController {
  constructor(
    private readonly pipelineService: PipelineService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Get('filesystem/:filesystemId')
  @RequirePermission(P.workflows.read)
  async list(@Param('filesystemId', ParseUUIDPipe) filesystemId: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.pipelineService.listPipelines(tenantId, filesystemId);
  }

  @Get('document/:documentId/runs')
  @RequirePermission(P.workflows.read)
  async listRuns(@Param('documentId', ParseUUIDPipe) documentId: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.pipelineService.listRuns(documentId, tenantId);
  }

  @Get(':id')
  @RequirePermission(P.workflows.read)
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.pipelineService.getPipelineWithSteps(id, tenantId);
  }

  @Post()
  @RequirePermission(P.workflows.manage)
  async create(@Body() body: CreatePipelineDto) {
    const tenantId = this.tenantContext.getTenantId();
    return this.pipelineService.createPipeline(tenantId, body);
  }

  @Put(':id')
  @RequirePermission(P.workflows.manage)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdatePipelineDto) {
    const tenantId = this.tenantContext.getTenantId();
    return this.pipelineService.updatePipeline(id, tenantId, body);
  }

  @Delete(':id')
  @RequirePermission(P.workflows.manage)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.pipelineService.deletePipeline(id, tenantId);
  }

  @Put(':id/steps')
  @RequirePermission(P.workflows.manage)
  async replaceSteps(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { steps: PipelineStepInput[] },
  ) {
    const tenantId = this.tenantContext.getTenantId();
    return this.pipelineService.bulkUpsertSteps(id, tenantId, body.steps ?? []);
  }
}
