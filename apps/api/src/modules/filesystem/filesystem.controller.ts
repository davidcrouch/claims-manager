import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { FilesystemService } from './filesystem.service';
import {
  SetupFilesystemDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  ReplaceCategoriesDto,
} from './dto';

@Controller('filesystems')
export class FilesystemController {
  constructor(private readonly filesystemService: FilesystemService) {}

  @Get()
  async getFilesystem() {
    return this.filesystemService.getOrCreateFilesystem();
  }

  @Post('setup')
  async setupFromTemplate(@Body() dto: SetupFilesystemDto) {
    return this.filesystemService.setupFromTemplate(dto);
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
