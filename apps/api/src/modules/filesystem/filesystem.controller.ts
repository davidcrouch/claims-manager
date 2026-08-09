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
import type {
  ArtifactExportScope,
  UpdateArtifactExportSettingsDto,
} from './artifact-export.types';

@Controller('filesystems')
export class FilesystemController {
  constructor(private readonly filesystemService: FilesystemService) {}

  /** @deprecated Prefer GET /filesystems/company */
  @Get()
  async getFilesystem() {
    return this.filesystemService.getFilesystem();
  }

  @Get('company')
  async getCompanyFilesystem() {
    return this.filesystemService.getCompanyFilesystem();
  }

  @Get('overview')
  async getOverview() {
    return this.filesystemService.getOverview();
  }

  @Get('categories/search')
  async searchCategories(@Query('q') q?: string) {
    return this.filesystemService.searchCategories(q ?? '');
  }

  @Get('defaults')
  async getDefaults() {
    return this.filesystemService.getFilesystemDefaults();
  }

  @Patch('defaults')
  async updateDefaults(@Body() dto: UpdateFilesystemDefaultsDto) {
    return this.filesystemService.updateFilesystemDefaults(dto);
  }

  @Get('jobs/:jobId')
  async getJobFilesystem(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query('ensure') ensure?: string,
  ) {
    return this.filesystemService.getJobFilesystem(jobId, {
      ensure: ensure !== 'false',
    });
  }

  @Post('jobs/:jobId/setup')
  async setupJobFilesystem(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: SetupJobFilesystemDto,
  ) {
    return this.filesystemService.setupJobFilesystem(jobId, dto.templateId);
  }

  @Post('backfill-project-filesystems')
  async backfillProjectFilesystems() {
    return this.filesystemService.backfillMissingProjectFilesystems();
  }

  @Post('setup')
  async setupFromTemplate(@Body() dto: SetupFilesystemDto) {
    return this.filesystemService.setupFromTemplate(dto);
  }

  @Post('setup-default')
  async setupFromDefault() {
    return this.filesystemService.setupFromDefault();
  }

  @Post('generate-category-description')
  async generateCategoryDescription(@Body() dto: GenerateCategoryDescriptionDto) {
    return this.filesystemService.generateCategoryDescription(dto);
  }

  @Get('artifact-export')
  async getArtifactExport(@Query('scope') scope?: ArtifactExportScope) {
    return this.filesystemService.getArtifactExportSettings(scope ?? 'company');
  }

  @Patch('artifact-export')
  async updateArtifactExport(@Body() body: UpdateArtifactExportSettingsDto) {
    return this.filesystemService.updateArtifactExportSettings(body);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { name?: string },
  ) {
    return this.filesystemService.updateFilesystem(id, body);
  }

  @Put(':id/categories')
  async replaceCategories(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceCategoriesDto,
  ) {
    return this.filesystemService.replaceCategories(id, dto);
  }

  @Post(':id/categories')
  async addCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.filesystemService.addCategory(id, dto);
  }

  @Patch(':id/categories/:categoryId')
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.filesystemService.updateCategory(id, categoryId, dto);
  }

  @Delete(':id/categories/:categoryId')
  async archiveCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.filesystemService.archiveCategory(id, categoryId);
  }
}
