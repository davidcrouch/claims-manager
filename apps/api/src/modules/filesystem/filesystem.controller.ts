import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { FilesystemService } from './filesystem.service';
import {
  SetupFilesystemDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  ReplaceCategoriesDto,
} from './dto';
import { GenerateCategoryDescriptionDto } from './dto/generate-category-description.dto';
import { SetupJobFilesystemDto } from './dto/setup-job-filesystem.dto';
import { UpdateFilesystemDefaultsDto } from './dto/update-filesystem-defaults.dto';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
import type {
  ArtifactExportScope,
  UpdateArtifactExportSettingsDto,
} from './artifact-export.types';
import type {
  FolderMappingRole,
  UpdateProjectFolderMappingsDto,
} from './folder-mappings.types';

@Controller('filesystems')
export class FilesystemController {
  constructor(private readonly filesystemService: FilesystemService) {}

  /** @deprecated Prefer GET /filesystems/company */
  @Get()
  @RequirePermission(P.filesystems.read)
  async getFilesystem() {
    return this.filesystemService.getFilesystem();
  }

  @Get('company')
  @RequirePermission(P.filesystems.read)
  async getCompanyFilesystem() {
    return this.filesystemService.getCompanyFilesystem();
  }

  @Get('overview')
  @RequirePermission(P.filesystems.read)
  async getOverview() {
    return this.filesystemService.getOverview();
  }

  @Get('categories/search')
  @RequirePermission(P.filesystems.read)
  async searchCategories(@Query('q') q?: string) {
    return this.filesystemService.searchCategories(q ?? '');
  }

  @Get('defaults')
  @RequirePermission(P.filesystems.read)
  async getDefaults() {
    return this.filesystemService.getFilesystemDefaults();
  }

  @Patch('defaults')
  @RequirePermission(P.filesystems.manage)
  async updateDefaults(@Body() dto: UpdateFilesystemDefaultsDto) {
    return this.filesystemService.updateFilesystemDefaults(dto);
  }

  @Get('jobs/:jobId')
  @RequirePermission(P.filesystems.read)
  async getJobFilesystem(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query('ensure') ensure?: string,
  ) {
    return this.filesystemService.getJobFilesystem(jobId, {
      ensure: ensure !== 'false',
    });
  }

  @Post('jobs/:jobId/setup')
  @RequirePermission(P.filesystems.manage)
  async setupJobFilesystem(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: SetupJobFilesystemDto,
  ) {
    return this.filesystemService.setupJobFilesystem(jobId, dto.templateId);
  }

  @Post('backfill-project-filesystems')
  @RequirePermission(P.filesystems.manage)
  async backfillProjectFilesystems() {
    return this.filesystemService.backfillMissingProjectFilesystems();
  }

  @Post('setup')
  @RequirePermission(P.filesystems.manage)
  async setupFromTemplate(@Body() dto: SetupFilesystemDto) {
    return this.filesystemService.setupFromTemplate(dto);
  }

  @Post('setup-default')
  @RequirePermission(P.filesystems.manage)
  async setupFromDefault() {
    return this.filesystemService.setupFromDefault();
  }

  @Post('generate-category-description')
  @RequirePermission(P.filesystems.manage)
  async generateCategoryDescription(@Body() dto: GenerateCategoryDescriptionDto) {
    return this.filesystemService.generateCategoryDescription(dto);
  }

  @Get('artifact-export')
  @RequirePermission(P.filesystems.read)
  async getArtifactExport(@Query('scope') scope?: ArtifactExportScope) {
    return this.filesystemService.getArtifactExportSettings(scope ?? 'company');
  }

  @Patch('artifact-export')
  @RequirePermission(P.filesystems.manage)
  async updateArtifactExport(@Body() body: UpdateArtifactExportSettingsDto) {
    return this.filesystemService.updateArtifactExportSettings(body);
  }

  @Get('folder-mappings')
  @RequirePermission(P.filesystems.read)
  async getFolderMappings() {
    return this.filesystemService.getProjectFolderMappings();
  }

  @Patch('folder-mappings')
  @RequirePermission(P.filesystems.manage)
  async updateFolderMappings(@Body() body: UpdateProjectFolderMappingsDto) {
    return this.filesystemService.updateProjectFolderMappings(body);
  }

  @Get('jobs/:jobId/folder-mapping/:role')
  @RequirePermission(P.filesystems.read)
  async resolveJobFolderMapping(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('role') role: FolderMappingRole,
  ) {
    const resolved = await this.filesystemService.resolveProjectFolderCategory(jobId, role);
    return resolved ?? { filesystemId: null, categoryId: null, slug: null };
  }

  @Put(':id')
  @RequirePermission(P.filesystems.manage)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { name?: string },
  ) {
    return this.filesystemService.updateFilesystem(id, body);
  }

  @Put(':id/categories')
  @RequirePermission(P.filesystems.manage)
  async replaceCategories(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceCategoriesDto,
  ) {
    return this.filesystemService.replaceCategories(id, dto);
  }

  @Post(':id/categories')
  @RequirePermission(P.filesystems.manage)
  async addCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.filesystemService.addCategory(id, dto);
  }

  @Patch(':id/categories/:categoryId')
  @RequirePermission(P.filesystems.manage)
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.filesystemService.updateCategory(id, categoryId, dto);
  }

  @Delete(':id/categories/:categoryId')
  @RequirePermission(P.filesystems.manage)
  async archiveCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.filesystemService.archiveCategory(id, categoryId);
  }
}
